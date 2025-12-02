/**
 * Analytics Event Functions
 *
 * Type-safe event tracking functions for all user interactions.
 * All functions are fire-and-forget (void return, never throw).
 *
 * @module analytics/events
 */

import type { LayerName } from '../core/config';
import { AREA_EXPLORED_DEBOUNCE_MS, debounce, safeTrack } from './tracker';
import type { FacilityType, LocationFailureReason, LocationType } from './types';

// =============================================================================
// Map Engagement Events (P1)
// =============================================================================

/**
 * Track map loaded event
 * @param locationType - How the initial location was determined
 */
export const trackMapLoaded = (locationType: LocationType): void => {
	safeTrack('map_loaded', { location_type: locationType });
};

/**
 * Track marker clicked event
 * @param facilityType - Type of facility clicked
 */
export const trackMarkerClicked = (facilityType: FacilityType): void => {
	safeTrack('marker_clicked', { facility_type: facilityType });
};

/**
 * Track navigation started event
 * @param facilityType - Type of facility being navigated to
 */
export const trackNavigationStarted = (facilityType: FacilityType): void => {
	safeTrack('navigation_started', { facility_type: facilityType });
};

// =============================================================================
// Layer Events (P2)
// =============================================================================

/**
 * Track layer enabled event
 * @param layerName - Name of the layer enabled
 * @param activeLayerCount - Total number of active layers after enabling
 */
export const trackLayerEnabled = (layerName: LayerName, activeLayerCount: number): void => {
	safeTrack('layer_enabled', {
		layer_name: layerName,
		active_count: activeLayerCount,
	});
};

/**
 * Track layer disabled event
 * @param layerName - Name of the layer disabled
 * @param activeLayerCount - Total number of active layers after disabling
 */
export const trackLayerDisabled = (layerName: LayerName, activeLayerCount: number): void => {
	safeTrack('layer_disabled', {
		layer_name: layerName,
		active_count: activeLayerCount,
	});
};

// =============================================================================
// Location Events (P2)
// =============================================================================

/**
 * Track locate requested event
 */
export const trackLocateRequested = (): void => {
	safeTrack('locate_requested');
};

/**
 * Track locate success event
 */
export const trackLocateSuccess = (): void => {
	safeTrack('locate_success');
};

/**
 * Track locate failed event
 * @param reason - Category of failure (no PII)
 */
export const trackLocateFailed = (reason: LocationFailureReason): void => {
	safeTrack('locate_failed', { reason });
};

// =============================================================================
// Exploration Events (P3)
// =============================================================================

/**
 * Internal: Track area explored event (non-debounced)
 * Used by the debounced wrapper
 */
const trackAreaExploredInternal = (): void => {
	safeTrack('area_explored');
};

/**
 * Track area explored event (debounced)
 * Fires max once per AREA_EXPLORED_DEBOUNCE_MS (2000ms) per FR-004
 */
export const trackAreaExplored = debounce(trackAreaExploredInternal, AREA_EXPLORED_DEBOUNCE_MS);

/**
 * Track empty area event
 * @param facilityType - Type of facility that was not found
 */
export const trackEmptyArea = (facilityType: FacilityType): void => {
	safeTrack('empty_area', { facility_type: facilityType });
};
