/**
 * Analytics Module Public API
 *
 * This is the ONLY file to import from when using analytics.
 * Do not import from internal files (tracker.ts, events.ts, types.ts) directly.
 *
 * @example
 * // ✅ CORRECT: Import from index
 * import { trackMapLoaded, trackMarkerClicked } from '../analytics';
 *
 * // ❌ WRONG: Don't import from internal files
 * import { safeTrack } from '../analytics/tracker';
 *
 * @module analytics
 */

// =============================================================================
// Event Tracking Functions
// =============================================================================

export {
	// Map Engagement (P1)
	trackMapLoaded,
	trackMarkerClicked,
	trackNavigationStarted,
	// Layer Events (P2)
	trackLayerDisabled,
	trackLayerEnabled,
	// Location Events (P2)
	trackLocateFailed,
	trackLocateRequested,
	trackLocateSuccess,
	// Exploration Events (P3)
	trackAreaExplored,
	trackEmptyArea,
} from './events';

// =============================================================================
// Analytics Status
// =============================================================================

export { isAnalyticsEnabled } from './tracker';

// =============================================================================
// Types (for consumers who need type annotations)
// =============================================================================

export type {
	FacilityType,
	LayerName,
	LocationFailureReason,
	LocationType,
	// Event types for advanced usage
	AnalyticsEvent,
	AnalyticsEventKind,
	AreaExploredEvent,
	EmptyAreaEvent,
	LayerDisabledEvent,
	LayerEnabledEvent,
	LocateFailedEvent,
	LocateRequestedEvent,
	LocateSuccessEvent,
	MapLoadedEvent,
	MarkerClickedEvent,
	NavigationStartedEvent,
} from './types';
