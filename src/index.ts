import * as L from 'leaflet';
import drinkingWater from './oql/drinking_water.overpassql?raw';
import { isOk } from './types/result';
import { fetchWaterPointsInBounds } from './features/data/fetch';
import { addMarkers } from './features/markers/markers';
import { detectInitialLocation, locateUser } from './features/location/geolocation';
import { findNearestWaterPoint, haversineDistance } from './utils/geometry';
import { showNotification } from './ui/notifications';
import { showLoading, hideLoading } from './ui/loading';
import * as logger from './utils/logger';
import { RIGA_CENTER, DEFAULT_ZOOM, MAX_ZOOM, OSM_TILE_URL, OSM_ATTRIBUTION } from './core/config';
import type { Element } from './types/overpass';

/**
 * Initialize and setup the map
 */
async function initializeApp(): Promise<void> {
	try {
		// Show loading indicator for location detection
		showLoading(200);

		// Detect initial location
		const locationResult = await detectInitialLocation();

		let mapCenter: L.LatLngTuple = RIGA_CENTER;
		let userLocation: { lat: number; lon: number } | null = null;

		if (isOk(locationResult)) {
			// Location detected successfully
			const { latitude, longitude } = locationResult.value.coords;
			mapCenter = [latitude, longitude];
			userLocation = { lat: latitude, lon: longitude };
			logger.info('Location detected:', latitude, longitude);
		} else {
			// Location detection failed - fall back to Riga
			logger.warn('Location detection failed:', locationResult.error.message);
			showNotification(
				'Could not detect your location. Showing Riga area.',
				'info',
				5000
			);
		}

		hideLoading();

		// Initialize map with determined center
		const map = L.map('map', {
			center: mapCenter,
			zoom: DEFAULT_ZOOM,
			zoomControl: true,
		});

		L.tileLayer(OSM_TILE_URL, {
			maxZoom: MAX_ZOOM,
			attribution: OSM_ATTRIBUTION,
		}).addTo(map);

		L.control.scale({ metric: true, imperial: false }).addTo(map);

		// Layer to hold water points
		const pointsLayer: L.FeatureGroup<L.CircleMarker> = L.featureGroup().addTo(map);

		// Show loading indicator while fetching water points
		showLoading(200);

		// Fetch water points based on current map bounds
		const result = await fetchWaterPointsInBounds(drinkingWater, map.getBounds());

		hideLoading();

		if (!isOk(result)) {
			// Handle fetch error
			const errorMessages = {
				network:
					'Failed to load water points. Please check your internet connection and try refreshing the page.',
				timeout: 'Request timed out while loading water points. Please try refreshing the page.',
				parse: 'Failed to parse water point data. Please try refreshing the page.',
			};

			const message =
				errorMessages[result.error.type] ||
				'Failed to load water points. Please try refreshing the page.';
			showNotification(message, 'error', 0);
			logger.error('Failed to fetch water points:', result.error);
			return;
		}

		let nodes = result.value;

		// Handle empty state
		if (nodes.length === 0) {
			showNotification(
				'No water points found in the current area. Try zooming out or refreshing the page.',
				'warning',
				0
			);
			logger.warn('No water points returned from API');
			return;
		}

		// Calculate nearest point and distances if user location is available
		let nearestPoint: Element | null = null;
		if (userLocation) {
			nearestPoint = findNearestWaterPoint(userLocation.lat, userLocation.lon, nodes);

			// Enrich nodes with distance information
			nodes = nodes.map((node) => ({
				...node,
				distanceFromUser: haversineDistance(
					userLocation.lat,
					userLocation.lon,
					node.lat,
					node.lon
				),
				isNearest: nearestPoint !== null && node.id === nearestPoint.id,
			}));

			if (nearestPoint) {
				const distanceKm = nodes.find(n => n.id === nearestPoint?.id)?.distanceFromUser || 0;
				const distanceStr = distanceKm < 1000
					? `${Math.round(distanceKm)}m`
					: `${(distanceKm / 1000).toFixed(2)}km`;
				logger.info(`Nearest water point: ${nearestPoint.id} (${distanceStr} away)`);
			}
		}

		// Add markers to map with nearest point highlighting
		addMarkers(nodes, pointsLayer, map, nearestPoint);

		// Add layer control
		L.control.layers(undefined, { 'Water taps': pointsLayer }, { collapsed: false }).addTo(map);

		// Fit bounds to points if available (but don't zoom in too much if we have location)
		const bounds = pointsLayer.getBounds();
		if (bounds.isValid() && !userLocation) {
			map.fitBounds(bounds.pad(0.01), { maxZoom: 15 });
		}

		// Setup locate control
		setupLocateControl(map);

		logger.info(`Successfully loaded ${nodes.length} water points`);
	} catch (error) {
		hideLoading();
		showNotification(
			'An unexpected error occurred while initializing the map. Please refresh the page.',
			'error',
			0
		);
		logger.error('App initialization error:', error instanceof Error ? error.message : error);
	}
}

/**
 * Setup the locate control button
 */
function setupLocateControl(map: L.Map): void {
	const LocateControl = L.Control.extend({
		onAdd: () => {
			const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control locate-control');
			const link = L.DomUtil.create('a', '', container);
			link.href = '#';
			link.title = 'Show my location';
			link.setAttribute('aria-label', 'Show my location');
			link.setAttribute('role', 'button');
			link.setAttribute('tabindex', '0');
			link.innerHTML = '📍';

			// Click handler
			const handleClick = (e: Event) => {
				e.preventDefault();
				e.stopPropagation();
				locateUser(map);
			};

			L.DomEvent.on(link, 'click', handleClick);

			// Keyboard handler
			link.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					locateUser(map);
				}
			});

			return container;
		},
	});

	const locateControl = new LocateControl({ position: 'topright' });
	locateControl.addTo(map);
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeApp);
} else {
	initializeApp();
}

// Try registering service worker for offline (if present)
if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('sw.js').catch((err) => {
		logger.info('Service worker registration failed:', err instanceof Error ? err.message : err);
	});
}
