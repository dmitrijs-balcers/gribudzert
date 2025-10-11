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
import { setupMapNavigationHandlers } from './features/navigation/navigation';
import type { Element } from './types/overpass';

/**
 * Update the location info display in the bottom right
 */
function updateLocationInfo(lat: number, lon: number, isUserLocation: boolean): void {
	const locationInfoEl = document.getElementById('location-info');
	if (!locationInfoEl) return;

	// Use Nominatim to reverse geocode the coordinates
	const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;

	fetch(url)
		.then(response => response.json())
		.then(data => {
			const city = data.address?.city || data.address?.town || data.address?.village || 'Unknown';
			const country = data.address?.country || '';
			const locationText = country ? `${city}, ${country}` : city;
			locationInfoEl.textContent = isUserLocation ? `${locationText} (Your Location)` : locationText;
		})
		.catch(() => {
			// Fallback if geocoding fails
			locationInfoEl.textContent = isUserLocation
				? `${lat.toFixed(4)}, ${lon.toFixed(4)} (Your Location)`
				: `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
		});
}

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
		let isUserLocation = false;

		if (isOk(locationResult)) {
			// Location detected successfully
			const { latitude, longitude } = locationResult.value.coords;
			mapCenter = [latitude, longitude];
			userLocation = { lat: latitude, lon: longitude };
			isUserLocation = true;
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

		// Update location info display
		updateLocationInfo(mapCenter[0], mapCenter[1], isUserLocation);

		// Layer to hold water points
		const pointsLayer: L.FeatureGroup<L.CircleMarker> = L.featureGroup().addTo(map);

		// Load initial water points
		await loadWaterPoints(map, pointsLayer, userLocation);

		// Add layer control
		L.control.layers(undefined, { 'Water taps': pointsLayer }, { collapsed: false }).addTo(map);

		// Setup locate control
		setupLocateControl(map);

		// Setup map navigation handlers for dynamic refetching
		setupMapNavigationHandlers(map, async (bounds: L.LatLngBounds) => {
			await loadWaterPoints(map, pointsLayer, userLocation, bounds);
		});

		logger.info('App initialization complete');
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
 * Load water points for given bounds and update markers
 */
async function loadWaterPoints(
	map: L.Map,
	pointsLayer: L.FeatureGroup<L.CircleMarker>,
	userLocation: { lat: number; lon: number } | null,
	bounds?: L.LatLngBounds
): Promise<void> {
	// Show loading indicator while fetching water points
	showLoading(200);

	// Use provided bounds or current map bounds
	const fetchBounds = bounds || map.getBounds();

	// Fetch water points based on bounds
	const result = await fetchWaterPointsInBounds(drinkingWater, fetchBounds);

	hideLoading();

	if (!isOk(result)) {
		// Handle fetch error
		const errorMessages = {
			network:
				'Failed to load water points. Please check your internet connection and try again.',
			timeout: 'Request timed out while loading water points. Please try again.',
			parse: 'Failed to parse water point data. Please try again.',
		};

		const message =
			errorMessages[result.error.type] ||
			'Failed to load water points. Please try again.';
		showNotification(message, 'error', 5000);
		logger.error('Failed to fetch water points:', result.error);
		return;
	}

	let nodes = result.value;

	// Handle empty state
	if (nodes.length === 0) {
		showNotification(
			'No water points found in this area. Try zooming out or panning to a different location.',
			'info',
			5000
		);
		logger.warn('No water points returned from API for current bounds');

		// Clear existing markers
		pointsLayer.clearLayers();
		return;
	}

	// Calculate nearest point relative to reference location
	let nearestPoint: Element | null = null;
	let referenceLocation: { lat: number; lon: number } | null = null;

	if (userLocation) {
		// Use user location if available
		referenceLocation = userLocation;
		nearestPoint = findNearestWaterPoint(userLocation.lat, userLocation.lon, nodes);
	} else {
		// Use map center as reference when panning without user location
		const mapCenter = map.getCenter();
		referenceLocation = { lat: mapCenter.lat, lon: mapCenter.lng };
		nearestPoint = findNearestWaterPoint(mapCenter.lat, mapCenter.lng, nodes);
	}

	// Enrich nodes with distance information
	nodes = nodes.map((node) => ({
		...node,
		distanceFromUser: haversineDistance(
			referenceLocation.lat,
			referenceLocation.lon,
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

	// Clear existing markers and add new ones
	pointsLayer.clearLayers();
	addMarkers(nodes, pointsLayer, map, nearestPoint);

	logger.info(`Successfully loaded ${nodes.length} water points`);
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
