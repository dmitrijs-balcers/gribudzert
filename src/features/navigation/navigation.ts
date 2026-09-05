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
 * Approximate viewport size (diagonal) in meters
 */
const diagonalMeters = (bounds: L.LatLngBounds): number => {
	const ne = bounds.getNorthEast();
	const sw = bounds.getSouthWest();
	return haversineDistance(ne.lat, ne.lng, sw.lat, sw.lng);
};

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
	const viewportDiagonal = diagonalMeters(oldBounds);

	// Check if movement is >= 25% of viewport diagonal
	const threshold = viewportDiagonal * MOVEMENT_THRESHOLD_PERCENTAGE;
	return distanceMoved >= threshold;
}

/**
 * Callback function when bounds change significantly
 */
export type BoundsChangeCallback = (bounds: L.LatLngBounds) => void;

/**
 * Options for the navigation handlers
 */
export type NavigationHandlerOptions = {
	/**
	 * Bounds already loaded when the handlers are attached. When given, the first `moveend`
	 * is compared against them instead of unconditionally triggering the callback.
	 */
	readonly initialBounds?: L.LatLngBounds;
};

/**
 * Whether the viewport size changed by at least the movement threshold (i.e. the map was zoomed).
 * A pure zoom keeps the centre in place, so centre movement alone would never detect it.
 *
 * @param oldBounds - Previous bounds
 * @param newBounds - Current bounds
 * @returns true when the viewport diagonal changed by >= 25%
 */
export function hasZoomedSignificantly(
	oldBounds: L.LatLngBounds,
	newBounds: L.LatLngBounds
): boolean {
	const oldDiagonal = diagonalMeters(oldBounds);
	const newDiagonal = diagonalMeters(newBounds);
	if (oldDiagonal === 0) {
		return newDiagonal !== 0;
	}
	return Math.abs(newDiagonal - oldDiagonal) / oldDiagonal >= MOVEMENT_THRESHOLD_PERCENTAGE;
}

/**
 * Whether a refetch is warranted: the map was panned or zoomed significantly
 */
export function shouldRefetch(oldBounds: L.LatLngBounds, newBounds: L.LatLngBounds): boolean {
	return (
		hasMovedSignificantly(oldBounds, newBounds) || hasZoomedSignificantly(oldBounds, newBounds)
	);
}

/**
 * Setup map navigation handlers for panning and zooming
 * Debounces `moveend` (which Leaflet also fires after a zoom) and only fires the callback
 * when the viewport moved or resized beyond the threshold.
 *
 * @param map - Leaflet map instance
 * @param onBoundsChange - Callback to execute when bounds change significantly
 * @param options - Optional initial bounds to compare the first event against
 * @returns Cleanup function to remove event listeners
 */
export function setupMapNavigationHandlers(
	map: L.Map,
	onBoundsChange: BoundsChangeCallback,
	options: NavigationHandlerOptions = {}
): () => void {
	let lastFetchBounds: L.LatLngBounds | null = options.initialBounds ?? null;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	const handleMoveEnd = () => {
		// Clear existing timer
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
		}

		// Set up debounced check
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			const currentBounds = map.getBounds();

			// First fetch - always trigger
			if (lastFetchBounds === null || shouldRefetch(lastFetchBounds, currentBounds)) {
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
