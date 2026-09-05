import type * as L from 'leaflet';
import { FETCH_PADDING_FACTOR, MIN_FETCH_ZOOM } from '../../core/config';
import { haversineDistance } from '../../utils/geometry';
import { padBounds } from './bounds';

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
 * Whether the viewport grew by at least the movement threshold relative to `oldBounds`.
 *
 * Only growth counts, not shrinkage: zooming in only narrows the area a fetch would need
 * to cover, and the wider, already-loaded padded area covers a narrower view by
 * definition, so shrinking never by itself warrants a refetch. Zooming out can outgrow
 * what was loaded even when a bounds comparison lands right on the boundary (e.g. one zoom
 * level, which roughly doubles the viewport, against a padding factor of exactly 2), so
 * this backs up the containment check in `shouldRefetch` rather than replacing it.
 *
 * @param oldBounds - Previous bounds
 * @param newBounds - Current bounds
 * @returns true when the viewport diagonal grew by >= 25%
 */
export function hasGrownSignificantly(
	oldBounds: L.LatLngBounds,
	newBounds: L.LatLngBounds
): boolean {
	const oldDiagonal = diagonalMeters(oldBounds);
	const newDiagonal = diagonalMeters(newBounds);
	if (oldDiagonal === 0) {
		return newDiagonal > 0;
	}
	return (newDiagonal - oldDiagonal) / oldDiagonal >= MOVEMENT_THRESHOLD_PERCENTAGE;
}

/**
 * Whether a refetch is warranted: the current viewport no longer fits inside the padded
 * area that was loaded for `lastFetchBounds`, or it grew enough that a borderline fit
 * can't be trusted. Panning or zooming in while staying inside the padded area is free —
 * the data already loaded for the wider area covers it.
 *
 * @param lastFetchBounds - Unpadded viewport bounds that triggered the last fetch
 * @param currentBounds - Current viewport bounds
 */
export function shouldRefetch(
	lastFetchBounds: L.LatLngBounds,
	currentBounds: L.LatLngBounds
): boolean {
	const loadedBounds = padBounds(lastFetchBounds, FETCH_PADDING_FACTOR);
	if (!loadedBounds.contains(currentBounds)) {
		return true;
	}
	return hasGrownSignificantly(lastFetchBounds, currentBounds);
}

/**
 * Setup map navigation handlers for panning and zooming
 * Debounces `moveend` (which Leaflet also fires after a zoom) and only fires the callback
 * when the viewport is no longer covered by the last loaded (padded) area. `lastFetchBounds`
 * tracks the raw viewport that triggered the last fetch, not the padded area itself — it is
 * padded on demand with the same helper `exploreViewport` uses to compute what was actually
 * loaded, so the padding factor lives in exactly one place.
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

			if (map.getZoom() < MIN_FETCH_ZOOM) {
				// Too zoomed out for a fetch: the visible layers were just cleared (see
				// `passZoomGuard` in app/explore.ts), so nothing is "loaded" any more.
				// Forget it, so the next fetchable view always reloads rather than being
				// judged against a now-meaningless, possibly much smaller, old area.
				lastFetchBounds = null;
				onBoundsChange(currentBounds);
				return;
			}

			// First fetch, or the loaded area no longer covers the view - trigger
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
