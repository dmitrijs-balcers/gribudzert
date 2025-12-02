/**
 * Analytics Type Definitions
 *
 * Type-safe definitions for the analytics module.
 * Follows high cohesion / low coupling principles:
 * - Re-exports Umami types from contracts
 * - Imports domain types from existing modules (single source of truth)
 * - All event types as discriminated unions for exhaustive pattern matching
 *
 * @module analytics/types
 */

import type { LayerName } from '../core/config';
import type { LocationFailureCategory } from '../types/errors';
import type { Facility } from '../types/facilities';

// =============================================================================
// Re-export Umami types from contracts (DO NOT duplicate)
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
// Derived Types (single source of truth)
// =============================================================================

/**
 * Type of facility being interacted with.
 * DERIVED from Facility['kind'] to ensure type safety and single source of truth.
 */
export type FacilityType = Facility['kind'];

/**
 * Re-export LayerName from config for analytics consumers
 */
export type { LayerName };

/**
 * Location failure reason for analytics.
 * Re-exported from errors.ts for single source of truth.
 */
export type LocationFailureReason = LocationFailureCategory;

/**
 * How the initial map location was determined
 */
export type LocationType = 'user' | 'default';

// =============================================================================
// Analytics Event Discriminated Union
// =============================================================================

/**
 * Map loaded event - tracked when map initializes
 */
export type MapLoadedEvent = {
	readonly kind: 'map_loaded';
	readonly locationType: LocationType;
};

/**
 * Marker clicked event - tracked when user clicks a facility marker
 */
export type MarkerClickedEvent = {
	readonly kind: 'marker_clicked';
	readonly facilityType: FacilityType;
};

/**
 * Navigation started event - tracked when user clicks Navigate button
 */
export type NavigationStartedEvent = {
	readonly kind: 'navigation_started';
	readonly facilityType: FacilityType;
};

/**
 * Layer enabled event - tracked when user enables a layer
 */
export type LayerEnabledEvent = {
	readonly kind: 'layer_enabled';
	readonly layerName: LayerName;
	readonly activeLayerCount: number;
};

/**
 * Layer disabled event - tracked when user disables a layer
 */
export type LayerDisabledEvent = {
	readonly kind: 'layer_disabled';
	readonly layerName: LayerName;
	readonly activeLayerCount: number;
};

/**
 * Locate requested event - tracked when user clicks locate button
 */
export type LocateRequestedEvent = {
	readonly kind: 'locate_requested';
};

/**
 * Locate success event - tracked when location detection succeeds
 */
export type LocateSuccessEvent = {
	readonly kind: 'locate_success';
};

/**
 * Locate failed event - tracked when location detection fails
 */
export type LocateFailedEvent = {
	readonly kind: 'locate_failed';
	readonly reason: LocationFailureReason;
};

/**
 * Area explored event - tracked when user pans/zooms to new area (debounced)
 */
export type AreaExploredEvent = {
	readonly kind: 'area_explored';
};

/**
 * Empty area event - tracked when no facilities found in current view
 */
export type EmptyAreaEvent = {
	readonly kind: 'empty_area';
	readonly facilityType: FacilityType;
};

/**
 * Discriminated union of all analytics events.
 * Each event variant has a unique `kind` field for type narrowing.
 */
export type AnalyticsEvent =
	| MapLoadedEvent
	| MarkerClickedEvent
	| NavigationStartedEvent
	| LayerEnabledEvent
	| LayerDisabledEvent
	| LocateRequestedEvent
	| LocateSuccessEvent
	| LocateFailedEvent
	| AreaExploredEvent
	| EmptyAreaEvent;

/**
 * Extract event kind strings for type-safe event name handling
 */
export type AnalyticsEventKind = AnalyticsEvent['kind'];
