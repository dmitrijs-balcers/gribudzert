/**
 * Analytics Module Contracts
 *
 * Type-safe definitions for the analytics module public API.
 * This module follows high cohesion / low coupling principles:
 * - Self-contained with no dependencies on app modules
 * - Exposes only simple types (no Leaflet, no Element, no app-specific types)
 * - All functions are fire-and-forget (void return, no callbacks)
 *
 * @module analytics
 */

// =============================================================================
// Umami Global Type Declaration
// =============================================================================

/**
 * Umami tracker interface - subset of full API
 * Only declaring what we use for strict type safety
 */
export interface UmamiTracker {
	readonly track: UmamiTrackFunction;
}

/**
 * Overloaded track function signatures
 */
export interface UmamiTrackFunction {
	(): void;
	(eventName: string): void;
	(eventName: string, data: UmamiEventData): void;
}

/**
 * Valid event data for Umami
 * Constraints:
 * - Strings: max 500 characters
 * - Objects: max 50 properties
 * - Numbers: max 4 decimal places
 */
export type UmamiEventData = Readonly<Record<string, string | number | boolean>>;

// Augment global Window interface
declare global {
	interface Window {
		umami?: UmamiTracker;
	}
}

// =============================================================================
// Facility Types (used by multiple events)
// =============================================================================

/**
 * Type of facility being interacted with.
 * Used for marker clicks, navigation, and empty area events.
 */
export type FacilityType = 'water' | 'toilet';

// =============================================================================
// Map Engagement Events (P1)
// =============================================================================

/**
 * How the initial map location was determined
 */
export type LocationType = 'user' | 'default';

/**
 * Tracked when the map successfully initializes.
 *
 * @example
 * trackMapLoaded('user'); // User's location was detected
 * trackMapLoaded('default'); // Fell back to Riga center
 */
export type TrackMapLoaded = (locationType: LocationType) => void;

/**
 * Tracked when user clicks on a facility marker.
 *
 * @example
 * trackMarkerClicked('water'); // User clicked a water point
 * trackMarkerClicked('toilet'); // User clicked a toilet marker
 */
export type TrackMarkerClicked = (facilityType: FacilityType) => void;

/**
 * Tracked when user clicks Navigate button in popup.
 *
 * @example
 * trackNavigationStarted('water'); // User navigating to water point
 */
export type TrackNavigationStarted = (facilityType: FacilityType) => void;

// =============================================================================
// Layer Events (P2)
// =============================================================================

/**
 * Valid layer names in the application.
 * Must match exactly what appears in the layer control.
 */
export type LayerName = 'Drinking Points' | 'Public Toilets';

/**
 * Tracked when user enables a layer in the layer control.
 *
 * @example
 * trackLayerEnabled('Public Toilets', 2); // Toilets enabled, 2 layers active
 */
export type TrackLayerEnabled = (layerName: LayerName, activeLayerCount: number) => void;

/**
 * Tracked when user disables a layer in the layer control.
 *
 * @example
 * trackLayerDisabled('Public Toilets', 1); // Toilets disabled, 1 layer active
 */
export type TrackLayerDisabled = (layerName: LayerName, activeLayerCount: number) => void;

// =============================================================================
// Location Events (P2)
// =============================================================================

/**
 * Categories of location failure.
 * Must NOT contain PII or precise error messages.
 */
export type LocationFailureReason =
	| 'permission_denied'
	| 'position_unavailable'
	| 'timeout'
	| 'not_supported'
	| 'insecure_context';

/**
 * Tracked when user clicks the locate button.
 *
 * @example
 * trackLocateRequested(); // User clicked locate
 */
export type TrackLocateRequested = () => void;

/**
 * Tracked when location detection succeeds.
 *
 * @example
 * trackLocateSuccess(); // Location detected successfully
 */
export type TrackLocateSuccess = () => void;

/**
 * Tracked when location detection fails.
 *
 * @example
 * trackLocateFailed('permission_denied'); // User denied location permission
 */
export type TrackLocateFailed = (reason: LocationFailureReason) => void;

// =============================================================================
// Exploration Events (P3)
// =============================================================================

/**
 * Tracked after user pans/zooms to a new area.
 * This event is debounced (2000ms) to prevent flooding.
 *
 * @example
 * trackAreaExplored(); // User explored a new area
 */
export type TrackAreaExplored = () => void;

/**
 * Tracked when no facilities are found in the current view.
 *
 * @example
 * trackEmptyArea('water'); // No water points in current view
 */
export type TrackEmptyArea = (facilityType: FacilityType) => void;

// =============================================================================
// Analytics Status
// =============================================================================

/**
 * Check if analytics is currently enabled and available.
 * Returns false if:
 * - Umami script is not loaded
 * - User has Do Not Track enabled
 * - Script is blocked (ad blocker)
 *
 * @example
 * if (isAnalyticsEnabled()) {
 *   console.log('Analytics is tracking events');
 * }
 */
export type IsAnalyticsEnabled = () => boolean;

// =============================================================================
// Public API Interface
// =============================================================================

/**
 * Complete public API of the analytics module.
 * This interface defines all exports from `src/analytics/index.ts`.
 */
export interface AnalyticsAPI {
	// Map Engagement (P1)
	readonly trackMapLoaded: TrackMapLoaded;
	readonly trackMarkerClicked: TrackMarkerClicked;
	readonly trackNavigationStarted: TrackNavigationStarted;

	// Layer Events (P2)
	readonly trackLayerEnabled: TrackLayerEnabled;
	readonly trackLayerDisabled: TrackLayerDisabled;

	// Location Events (P2)
	readonly trackLocateRequested: TrackLocateRequested;
	readonly trackLocateSuccess: TrackLocateSuccess;
	readonly trackLocateFailed: TrackLocateFailed;

	// Exploration Events (P3)
	readonly trackAreaExplored: TrackAreaExplored;
	readonly trackEmptyArea: TrackEmptyArea;

	// Status
	readonly isAnalyticsEnabled: IsAnalyticsEnabled;
}
