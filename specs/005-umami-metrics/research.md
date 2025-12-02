# Research: Umami Analytics Events

**Feature**: 005-umami-metrics  
**Date**: 2025-12-02

## Research Tasks Completed

### 1. Umami JavaScript API

**Decision**: Use `window.umami.track(eventName, data)` for custom event tracking

**Rationale**:
- Umami script is already loaded in index.html with correct website ID
- `umami.track()` accepts event name (string) and optional data (object)
- Data supports JSON with limits: strings max 500 chars, objects max 50 properties
- Event names limited to 50 characters
- Function is non-blocking and handles its own error cases

**Alternatives considered**:
- Data attributes (`data-umami-event`): Rejected because we need programmatic control and typed data
- Umami API client package: Rejected - adds unnecessary dependency, cloud script already loaded

**API Reference** (from umami.is/docs/tracker-functions):
```typescript
// Custom event
umami.track(event_name: string);

// Custom event with data
umami.track(event_name: string, data: object);

// Pageview (automatic, not needed)
umami.track();
```

---

### 2. Graceful Failure Strategy

**Decision**: Check for `window.umami` existence before every call, wrap in try-catch

**Rationale**:
- Umami script may be blocked by ad-blockers (common scenario)
- Script may fail to load due to network issues
- User may have Do Not Track enabled (DNT)
- Analytics should NEVER crash the application

**Implementation Pattern**:
```typescript
const isUmamiAvailable = (): boolean => {
  return typeof window !== 'undefined' && 
         typeof window.umami === 'object' && 
         typeof window.umami.track === 'function';
};

const safeTrack = (eventName: string, data?: object): void => {
  try {
    if (isUmamiAvailable()) {
      window.umami.track(eventName, data);
    }
  } catch {
    // Silently ignore - analytics failures should never affect app
  }
};
```

**Alternatives considered**:
- Throwing errors: Rejected - violates silent failure requirement
- Queueing events until Umami loads: Rejected - adds complexity, not needed for analytics

---

### 3. TypeScript Type Declaration for Umami

**Decision**: Create minimal type declarations for `window.umami`

**Rationale**:
- Umami doesn't provide official TypeScript types
- We only use `track()` function, so minimal declaration is sufficient
- Enables compile-time type checking without `any`

**Type Declaration**:
```typescript
interface UmamiTracker {
  readonly track: {
    (): void; // pageview
    (eventName: string): void; // event
    (eventName: string, data: Record<string, unknown>): void; // event with data
  };
}

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}
```

---

### 4. Event Debouncing Strategy

**Decision**: Use a simple trailing-edge debounce for high-frequency events (map panning)

**Rationale**:
- Map moveend events fire frequently during panning
- Without debouncing, could send hundreds of events in short period
- 1-2 second debounce is sufficient for exploration events
- Keep debounce logic in the analytics module, not in callers

**Implementation**:
```typescript
type DebouncedFn<T extends (...args: unknown[]) => void> = T & { cancel: () => void };

const debounce = <T extends (...args: unknown[]) => void>(
  fn: T, 
  ms: number
): DebouncedFn<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const debounced = (...args: Parameters<T>): void => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
  
  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };
  
  return debounced as DebouncedFn<T>;
};
```

**Debounce Values**:
- `area_explored`: 2000ms (user settles on an area)
- All other events: No debounce (discrete user actions)

---

### 5. Do Not Track (DNT) Compliance

**Decision**: Check `navigator.doNotTrack` and respect user preference

**Rationale**:
- FR-008 requires respecting user privacy preferences
- Modern privacy-conscious users expect DNT to be honored
- Easy to implement with minimal overhead

**Implementation**:
```typescript
const respectsDoNotTrack = (): boolean => {
  return navigator.doNotTrack === '1' || 
         (window as Window & { doNotTrack?: string }).doNotTrack === '1';
};
```

---

### 6. Module Architecture (High Cohesion, Low Coupling)

**Decision**: Create self-contained `src/analytics/` module with minimal public API

**Rationale**:
- Analytics is orthogonal to core app functionality
- Should be easily disabled for development/testing
- Should be replaceable with different analytics provider
- No dependencies on app modules (one-way dependency only)

**Public API Surface**:
```typescript
// src/analytics/index.ts - ONLY exports
export { 
  trackMapLoaded,
  trackMarkerClicked,
  trackNavigationStarted,
  trackLayerEnabled,
  trackLayerDisabled,
  trackLocateRequested,
  trackLocateSuccess,
  trackLocateFailed,
  trackAreaExplored,
  trackEmptyArea,
  isAnalyticsEnabled,
} from './events';
```

**Coupling Strategy**:
- App modules import from `analytics/` 
- Analytics module has ZERO imports from app modules
- All data passed as simple primitives or plain objects (no Element, no Leaflet types)

---

### 7. Event Naming Convention

**Decision**: Use snake_case for event names, consistent with Umami conventions

**Rationale**:
- Umami dashboard displays event names as-is
- Snake_case is readable and consistent
- Matches examples in Umami documentation

**Event Names**:
| Event | Name | Data |
|-------|------|------|
| Map loaded | `map_loaded` | `{ location_type: 'user' \| 'default' }` |
| Marker clicked | `marker_clicked` | `{ facility_type: 'water' \| 'toilet' }` |
| Navigation started | `navigation_started` | `{ facility_type: 'water' \| 'toilet' }` |
| Layer enabled | `layer_enabled` | `{ layer_name: string, active_count: number }` |
| Layer disabled | `layer_disabled` | `{ layer_name: string, active_count: number }` |
| Locate requested | `locate_requested` | `{}` |
| Locate success | `locate_success` | `{}` |
| Locate failed | `locate_failed` | `{ reason: string }` |
| Area explored | `area_explored` | `{}` |
| Empty area | `empty_area` | `{ facility_type: 'water' \| 'toilet' }` |

---

## Summary

All NEEDS CLARIFICATION items resolved. The analytics module will:
1. Use Umami's `track()` function with strict TypeScript types
2. Fail silently when Umami is unavailable
3. Respect Do Not Track preferences
4. Debounce high-frequency events
5. Follow high cohesion / low coupling principles
6. Use discriminated unions for type-safe event handling
