import type * as L from 'leaflet';
import { haversineDistance } from '../../utils/geometry';

/**
 * Open external navigation app to navigate to coordinates
 * @param lat - Latitude as string
 * @param lon - Longitude as string
 * @param label - Label for the destination
 */
export function openNavigation(lat: string, lon: string, label: string): void {
	const latitude = Number.parseFloat(lat);
	const longitude = Number.parseFloat(lon);

	// Validate coordinates
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		console.error('Invalid coordinates for navigation:', lat, lon);
		return;
	}

	// Detect platform and open appropriate navigation URL
	const userAgent = navigator.userAgent.toLowerCase();
	const isIOS = /iphone|ipad|ipod/.test(userAgent);
	const isAndroid = /android/.test(userAgent);

	let navigationUrl: string;

	if (isIOS) {
		// Use Apple Maps on iOS
		navigationUrl = `maps://maps.apple.com/?daddr=${latitude},${longitude}&q=${encodeURIComponent(label)}`;
	} else if (isAndroid) {
		// Use Google Maps on Android
		navigationUrl = `google.navigation:q=${latitude},${longitude}`;
	} else {
		// Default to Google Maps web for desktop
		navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodeURIComponent(label)}`;
	}

	// Open navigation URL
	window.open(navigationUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Configuration for navigation handlers
 */
const MOVEMENT_THRESHOLD_PERCENTAGE = 0.25; // 25% of viewport
const DEBOUNCE_DELAY_MS = 300;

/**
 * Check if the map has moved significantly enough to warrant a refetch
 *
 * @param oldBounds - Previous bounds
 * @param newBounds - Current bounds
 * @returns true if movement exceeds threshold
 */
export function hasMovedSignificantly(
	oldBounds: L.LatLngBounds,
	newBounds: L.LatLngBounds
): boolean {
	// Get centers of both bounds
	const oldCenter = oldBounds.getCenter();
	const newCenter = newBounds.getCenter();

	// Calculate distance between centers in meters
	const distanceMoved = haversineDistance(
		oldCenter.lat,
		oldCenter.lng,
		newCenter.lat,
		newCenter.lng
	);

	// Calculate approximate viewport size (diagonal) in meters
	const oldNE = oldBounds.getNorthEast();
	const oldSW = oldBounds.getSouthWest();
	const viewportDiagonal = haversineDistance(oldNE.lat, oldNE.lng, oldSW.lat, oldSW.lng);

	// Check if movement is >= 25% of viewport diagonal
	const threshold = viewportDiagonal * MOVEMENT_THRESHOLD_PERCENTAGE;
	return distanceMoved >= threshold;
}

/**
 * Callback function when bounds change significantly
 */
export type BoundsChangeCallback = (bounds: L.LatLngBounds) => void;

/**
 * Setup map navigation handlers for panning and zooming
 * Debounces events and only fires callback when movement exceeds threshold
 *
 * @param map - Leaflet map instance
 * @param onBoundsChange - Callback to execute when bounds change significantly
 * @returns Cleanup function to remove event listeners
 */
export function setupMapNavigationHandlers(
	map: L.Map,
	onBoundsChange: BoundsChangeCallback
): () => void {
	let lastFetchBounds: L.LatLngBounds | null = null;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	const handleMoveEnd = () => {
		// Clear existing timer
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
		}

		// Set up debounced check
		debounceTimer = setTimeout(() => {
			const currentBounds = map.getBounds();

			// First fetch - always trigger
			if (lastFetchBounds === null) {
				lastFetchBounds = currentBounds;
				onBoundsChange(currentBounds);
				return;
			}

			// Check if movement is significant
			if (hasMovedSignificantly(lastFetchBounds, currentBounds)) {
				lastFetchBounds = currentBounds;
				onBoundsChange(currentBounds);
			}
		}, DEBOUNCE_DELAY_MS);
	};

	// Attach event listener
	map.on('moveend', handleMoveEnd);

	// Return cleanup function
	return () => {
		map.off('moveend', handleMoveEnd);
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
	};
}
