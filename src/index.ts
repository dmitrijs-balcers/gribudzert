import * as L from 'leaflet';
import { DEFAULT_ZOOM, MAX_ZOOM, OSM_ATTRIBUTION, OSM_TILE_URL, RIGA_CENTER } from './core/config';
import { fetchFacilitiesInBounds, fetchWaterPointsInBounds } from './features/data/fetch';
import { detectInitialLocation, locateUser } from './features/location/geolocation';
import { addMarkers, addToiletMarkers } from './features/markers/markers';
import { setupMapNavigationHandlers } from './features/navigation/navigation';
import drinkingWater from './oql/drinking_water.overpassql?raw';
import publicToilets from './oql/public_toilets.overpassql?raw';
import type { Element } from './types/overpass';
import { isOk } from './types/result';
import { hideLoading, showLoading } from './ui/loading';
import { showNotification } from './ui/notifications';
import { findNearestWaterPoint, haversineDistance } from './utils/geometry';
import * as logger from './utils/logger';

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
		let _isUserLocation = false;

		if (isOk(locationResult)) {
			// Location detected successfully
			const { latitude, longitude } = locationResult.value.coords;
			mapCenter = [latitude, longitude];
			userLocation = { lat: latitude, lon: longitude };
			_isUserLocation = true;
			logger.info('Location detected:', latitude, longitude);
		} else {
			// Location detection failed - fall back to Riga
			logger.warn('Location detection failed:', locationResult.error.message);
			showNotification('Could not detect your location. Showing Riga area.', 'info', 5000);
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
		const pointsLayer: L.FeatureGroup<L.CircleMarker | L.Marker> = L.featureGroup().addTo(map);

		// Layer to hold toilet markers (hidden by default)
		const toiletLayer: L.FeatureGroup<L.CircleMarker | L.Marker> = L.featureGroup();

		// Load initial water points
		await loadWaterPoints(map, pointsLayer, userLocation);

		// Add layer control with both water and toilet layers
		L.control
			.layers(
				undefined,
				{
					'Drinking Points': pointsLayer,
					'Public Toilets': toiletLayer,
				},
				{ collapsed: false }
			)
			.addTo(map);

		// Track which layers are active
		let toiletLayerActive = false;

		// Event handler for when toilet layer is added
		map.on('overlayadd', async (e: L.LayersControlEvent) => {
			if (e.name === 'Public Toilets') {
				toiletLayerActive = true;
				toiletLayer.addTo(map);
				await loadToilets(map, toiletLayer, userLocation);
			}
		});

		// Event handler for when toilet layer is removed
		map.on('overlayremove', (e: L.LayersControlEvent) => {
			if (e.name === 'Public Toilets') {
				toiletLayerActive = false;
				toiletLayer.clearLayers();
			}
		});

		// Setup locate control with callback to update user location and refetch water points
		setupLocateControl(map, pointsLayer, (lat: number, lon: number) => {
			// Update user location reference
			userLocation = { lat, lon };
			// The map.setView in locateUser will trigger moveend event,
			// which will automatically refetch water points via navigation handlers
		});

		// Setup map navigation handlers for dynamic refetching
		setupMapNavigationHandlers(map, async (bounds: L.LatLngBounds) => {
			await loadWaterPoints(map, pointsLayer, userLocation, bounds);
			// Also refetch toilets if layer is active
			if (toiletLayerActive) {
				await loadToilets(map, toiletLayer, userLocation, bounds);
			}
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
			network: 'Failed to load water points. Please check your internet connection and try again.',
			timeout: 'Request timed out while loading water points. Please try again.',
			parse: 'Failed to parse water point data. Please try again.',
		};

		const message =
			errorMessages[result.error.type] || 'Failed to load water points. Please try again.';
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
		const distanceKm = nodes.find((n) => n.id === nearestPoint?.id)?.distanceFromUser || 0;
		const distanceStr =
			distanceKm < 1000 ? `${Math.round(distanceKm)}m` : `${(distanceKm / 1000).toFixed(2)}km`;
		logger.info(`Nearest water point: ${nearestPoint.id} (${distanceStr} away)`);
	}

	// Clear existing markers and add new ones
	pointsLayer.clearLayers();
	addMarkers(nodes, pointsLayer, map, nearestPoint);

	logger.info(`Successfully loaded ${nodes.length} water points`);
}

/**
 * Load public toilets for given bounds and update markers
 */
async function loadToilets(
	map: L.Map,
	toiletLayer: L.FeatureGroup<L.CircleMarker>,
	userLocation: { lat: number; lon: number } | null,
	bounds?: L.LatLngBounds
): Promise<void> {
	// Show loading indicator while fetching toilets
	showLoading(200);

	// Use provided bounds or current map bounds
	const fetchBounds = bounds || map.getBounds();

	// Fetch toilet data based on bounds
	const result = await fetchFacilitiesInBounds(publicToilets, fetchBounds);

	hideLoading();

	if (!isOk(result)) {
		// Handle fetch error
		const errorMessages = {
			network: 'Failed to load toilet data. Please check your internet connection and try again.',
			timeout: 'Request timed out while loading toilet data. Please try again.',
			parse: 'Failed to parse toilet data. Please try again.',
		};

		const message =
			errorMessages[result.error.type] || 'Failed to load toilet data. Please try again.';
		showNotification(message, 'error', 5000);
		logger.error('Failed to fetch toilet data:', result.error);
		return;
	}

	let toilets = result.value;

	// Handle empty state
	if (toilets.length === 0) {
		showNotification('No public toilets found in this area.', 'info', 5000);
		logger.warn('No toilets returned from API for current bounds');

		// Clear existing toilet markers
		toiletLayer.clearLayers();
		return;
	}

	// Enrich toilets with distance information from user location
	if (userLocation) {
		toilets = toilets.map((toilet) => ({
			...toilet,
			distanceFromUser: haversineDistance(
				userLocation.lat,
				userLocation.lon,
				toilet.lat,
				toilet.lon
			),
		}));

		// Sort toilets by distance
		toilets.sort((a, b) => a.distanceFromUser - b.distanceFromUser);
	}

	// Clear existing toilet markers and add new ones
	toiletLayer.clearLayers();
	addToiletMarkers(toilets, toiletLayer, map);

	logger.info(`Successfully loaded ${toilets.length} public toilets`);
}

/**
 * Setup the locate control button
 */
function setupLocateControl(
	map: L.Map,
	_pointsLayer: L.FeatureGroup<L.CircleMarker>,
	onLocationUpdate: (lat: number, lon: number) => void
): void {
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
				locateUser(map, onLocationUpdate);
			};

			L.DomEvent.on(link, 'click', handleClick);

			// Keyboard handler
			link.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					locateUser(map, onLocationUpdate);
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
