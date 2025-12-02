# Data Model: Umami Analytics Events

**Feature**: 005-umami-metrics  
**Date**: 2025-12-02

## Entity Definitions

### 1. AnalyticsEvent (Discriminated Union)

**Purpose**: Type-safe representation of all trackable events with exhaustive pattern matching

```typescript
/**
 * Discriminated union of all analytics events.
 * Each event variant has a unique `kind` field for type narrowing.
 */
type AnalyticsEvent =
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
```

**Validation Rules**:
- `kind` field is the discriminator (required for all variants)
- All fields are `readonly` (immutability)
- Event data must conform to Umami limits (strings ≤500 chars, objects ≤50 properties)

**State Transitions**: Immutable - events are created once and sent

---

### 2. Map Engagement Events (P1)

**Purpose**: Track core user interactions with the map

```typescript
/**
 * Tracked when the map successfully initializes
 */
type MapLoadedEvent = {
  readonly kind: 'map_loaded';
  readonly locationType: LocationType;
};

/**
 * How the initial map location was determined
 */
type LocationType = 'user' | 'default';

/**
 * Tracked when user clicks on a facility marker
 */
type MarkerClickedEvent = {
  readonly kind: 'marker_clicked';
  readonly facilityType: FacilityType;
};

/**
 * Tracked when user clicks Navigate button in popup
 */
type NavigationStartedEvent = {
  readonly kind: 'navigation_started';
  readonly facilityType: FacilityType;
};

/**
 * Type of facility being interacted with
 */
type FacilityType = 'water' | 'toilet';
```

---

### 3. Layer Events (P2)

**Purpose**: Track layer show/hide interactions

```typescript
/**
 * Tracked when user enables a layer in the layer control
 */
type LayerEnabledEvent = {
  readonly kind: 'layer_enabled';
  readonly layerName: LayerName;
  readonly activeLayerCount: number;
};

/**
 * Tracked when user disables a layer in the layer control
 */
type LayerDisabledEvent = {
  readonly kind: 'layer_disabled';
  readonly layerName: LayerName;
  readonly activeLayerCount: number;
};

/**
 * Valid layer names in the application
 */
type LayerName = 'Drinking Points' | 'Public Toilets';
```

---

### 4. Location Events (P2)

**Purpose**: Track locate button usage and outcomes

```typescript
/**
 * Tracked when user clicks the locate button
 */
type LocateRequestedEvent = {
  readonly kind: 'locate_requested';
};

/**
 * Tracked when location detection succeeds
 */
type LocateSuccessEvent = {
  readonly kind: 'locate_success';
};

/**
 * Tracked when location detection fails
 */
type LocateFailedEvent = {
  readonly kind: 'locate_failed';
  readonly reason: LocationFailureReason;
};

/**
 * Categories of location failure (no PII)
 */
type LocationFailureReason = 
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'not_supported'
  | 'insecure_context';
```

---

### 5. Exploration Events (P3)

**Purpose**: Track map exploration behavior

```typescript
/**
 * Tracked after user pans/zooms to a new area (debounced)
 */
type AreaExploredEvent = {
  readonly kind: 'area_explored';
};

/**
 * Tracked when no facilities are found in the current view
 */
type EmptyAreaEvent = {
  readonly kind: 'empty_area';
  readonly facilityType: FacilityType;
};
```

---

### 6. Umami Tracker Interface

**Purpose**: Type declaration for the global Umami object

```typescript
/**
 * Umami tracker interface (subset of full API)
 * Only declaring what we use for type safety
 */
interface UmamiTracker {
  readonly track: UmamiTrackFunction;
}

/**
 * Overloaded track function signatures
 */
interface UmamiTrackFunction {
  (): void; // pageview
  (eventName: string): void; // event without data
  (eventName: string, data: UmamiEventData): void; // event with data
}

/**
 * Valid event data for Umami
 * - Strings: max 500 characters
 * - Objects: max 50 properties
 * - Numbers: max 4 decimal places
 */
type UmamiEventData = Readonly<Record<string, string | number | boolean>>;
```

---

### 7. Analytics State

**Purpose**: Track analytics module state (enabled/disabled)

```typescript
/**
 * Analytics availability status
 */
type AnalyticsStatus =
  | { readonly kind: 'available' }
  | { readonly kind: 'unavailable'; readonly reason: UnavailableReason };

/**
 * Reasons why analytics may be unavailable
 */
type UnavailableReason =
  | 'umami_not_loaded'
  | 'do_not_track'
  | 'script_blocked';
```

---

## Relationships

```
AnalyticsEvent (discriminated union)
├── MapLoadedEvent ─────────→ LocationType
├── MarkerClickedEvent ─────→ FacilityType
├── NavigationStartedEvent ─→ FacilityType
├── LayerEnabledEvent ──────→ LayerName
├── LayerDisabledEvent ─────→ LayerName
├── LocateRequestedEvent
├── LocateSuccessEvent
├── LocateFailedEvent ──────→ LocationFailureReason
├── AreaExploredEvent
└── EmptyAreaEvent ─────────→ FacilityType

Global Window
└── umami?: UmamiTracker
    └── track: UmamiTrackFunction ──→ UmamiEventData
```

---

## Type Guards

```typescript
/**
 * Type guard to check if Umami is available
 */
const isUmamiAvailable = (
  umami: unknown
): umami is UmamiTracker => {
  return (
    typeof umami === 'object' &&
    umami !== null &&
    'track' in umami &&
    typeof (umami as UmamiTracker).track === 'function'
  );
};

/**
 * Type guard to check if event is an engagement event
 */
const isEngagementEvent = (
  event: AnalyticsEvent
): event is MapLoadedEvent | MarkerClickedEvent | NavigationStartedEvent => {
  return (
    event.kind === 'map_loaded' ||
    event.kind === 'marker_clicked' ||
    event.kind === 'navigation_started'
  );
};
```

---

## Immutability Enforcement

All types use `readonly` modifiers to enforce immutability:

- Event types cannot be mutated after creation
- Event data objects are read-only
- This aligns with constitution principle on preferring immutable data structures
