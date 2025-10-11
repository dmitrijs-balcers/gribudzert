# Research & Technical Decisions: Location-Based Map Initialization

**Date**: 2025-10-10  
**Feature**: [spec.md](./spec.md) | [plan.md](./plan.md)

## Overview

This document captures research findings and technical decisions for implementing automatic location detection and dynamic water point fetching based on map viewport.

## Research Areas

### 1. Geolocation API Best Practices

**Decision**: Use browser Geolocation API with timeout and fallback strategy

**Rationale**:
- Standard Web API with broad browser support (97%+ global coverage)
- Already partially implemented in codebase (`src/features/location/geolocation.ts`)
- Provides accuracy information useful for initial zoom level
- Native permission UI provides clear user control
- Works in secure contexts (HTTPS/localhost) which app already requires

**Implementation approach**:
```typescript
// Extend existing geolocation.ts with initial detection
async function detectInitialLocation(): Promise<Result<Position, LocationError>> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ kind: 'success', value: position }),
      (error) => resolve({ kind: 'error', error: mapGeolocationError(error) }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
```

**Alternatives considered**:
- IP-based geolocation: Less accurate, privacy concerns, requires external service
- Manual location input: Poor UX for primary flow, can be added as enhancement
- Automatic tracking: Battery drain, privacy concerns, not needed for use case

**Best practices to follow**:
- Request permission on user action or page load with clear explanation
- Timeout after 10 seconds to prevent indefinite waiting
- Fall back to default location (Riga) on denial/timeout
- Show loading state after 200ms delay
- Cache last known location in session (not implemented in MVP)

### 2. Dynamic Data Fetching Based on Map Bounds

**Decision**: Fetch water points using Overpass API bbox parameter derived from Leaflet map bounds

**Rationale**:
- Overpass API supports bounding box queries natively
- Leaflet provides `getBounds()` method returning LatLngBounds
- More efficient than fetching all points globally
- Enables global app usage (not just Riga)
- Aligns with requirement FR-005

**Implementation approach**:
```typescript
// Modify fetchWaterPoints to accept bounds parameter
async function fetchWaterPointsInBounds(
  query: string, 
  bounds: L.LatLngBounds
): Promise<Result<Element[], FetchError>> {
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  // Inject bbox into Overpass query
  const modifiedQuery = query.replace('[bbox]', bbox);
  // ... existing fetch logic
}
```

**Alternatives considered**:
- Fetch all points once: Doesn't scale, network intensive, breaks in new locations
- Client-side filtering: Requires downloading all data, inefficient
- Geohash-based queries: More complex, Overpass doesn't support natively

**Best practices**:
- Debounce map movement events (300ms) to prevent excessive API calls
- Only refetch when bounds change significantly (>25% viewport)
- Show loading indicator for fetch operations
- Handle Overpass API rate limits with exponential backoff

### 3. Nearest Water Point Calculation

**Decision**: Calculate Haversine distance client-side after fetching points

**Rationale**:
- Simple algorithm, well-tested in literature
- Low computational cost for hundreds of points
- No additional API dependency
- Can reuse calculation for "recenter" feature

**Implementation approach**:
```typescript
// New utility in src/utils/geometry.ts
function haversineDistance(
  lat1: number, lon1: number, 
  lat2: number, lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

function findNearestWaterPoint(
  userLat: number, 
  userLon: number, 
  points: Element[]
): Element | null {
  if (points.length === 0) return null;
  
  return points.reduce((nearest, point) => {
    const distToPoint = haversineDistance(userLat, userLon, point.lat, point.lon);
    const distToNearest = haversineDistance(userLat, userLon, nearest.lat, nearest.lon);
    return distToPoint < distToNearest ? point : nearest;
  });
}
```

**Alternatives considered**:
- Pythagorean approximation: Less accurate for large distances
- Overpass API nearest query: Requires separate API call, complexity
- R-tree spatial index: Overkill for <1000 points in viewport

**Best practices**:
- Cache calculated distances to avoid recomputation
- Highlight nearest marker with different visual style
- Include distance in popup (e.g., "150m away")

### 4. Map Movement Event Handling

**Decision**: Use Leaflet's `moveend` event with debouncing and significant movement threshold

**Rationale**:
- `moveend` fires after pan/zoom animation completes
- Avoids firing during continuous panning
- Can calculate bounds delta to determine if refetch needed
- Already integrated with Leaflet event system

**Implementation approach**:
```typescript
// New feature in src/features/navigation/navigation.ts
let lastFetchBounds: L.LatLngBounds | null = null;

function hasMovedSignificantly(
  oldBounds: L.LatLngBounds, 
  newBounds: L.LatLngBounds
): boolean {
  const oldCenter = oldBounds.getCenter();
  const newCenter = newBounds.getCenter();
  const distance = haversineDistance(
    oldCenter.lat, oldCenter.lng,
    newCenter.lat, newCenter.lng
  );
  const viewportDiagonal = haversineDistance(
    oldBounds.getSouth(), oldBounds.getWest(),
    oldBounds.getNorth(), oldBounds.getEast()
  );
  // Refetch if moved >25% of viewport size
  return distance > (viewportDiagonal * 0.25);
}

function setupMapNavigationHandlers(
  map: L.Map,
  onBoundsChange: (bounds: L.LatLngBounds) => void
): void {
  let debounceTimer: number | null = null;
  
  map.on('moveend', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      const newBounds = map.getBounds();
      if (!lastFetchBounds || hasMovedSignificantly(lastFetchBounds, newBounds)) {
        lastFetchBounds = newBounds;
        onBoundsChange(newBounds);
      }
    }, 300);
  });
}
```

**Alternatives considered**:
- `move` event: Fires too frequently during drag
- `dragend` only: Misses zoom changes
- Polling: Inefficient, wastes resources

**Best practices**:
- Debounce 300ms to batch rapid movements
- Use 25% viewport threshold to avoid unnecessary fetches
- Cancel in-flight requests when new movement detected
- Maintain loading state during refetch

### 5. Permission State Management

**Decision**: Use discriminated union type for location permission states

**Rationale**:
- Type-safe exhaustive checking at compile time
- Clear state machine representation
- Aligns with project's ADT principles
- Explicit handling of all states prevents bugs

**Type definition**:
```typescript
// Add to src/types/platform.ts
type LocationPermissionState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'granted'; readonly position: GeolocationPosition }
  | { readonly kind: 'denied'; readonly reason: 'user-denied' | 'unavailable' }
  | { readonly kind: 'timeout' };

type LocationError =
  | { readonly type: 'permission-denied'; readonly message: string }
  | { readonly type: 'position-unavailable'; readonly message: string }
  | { readonly type: 'timeout'; readonly message: string }
  | { readonly type: 'not-supported'; readonly message: string };
```

**Alternatives considered**:
- Boolean flags: Error-prone, allows impossible states
- String enums: Less type-safe, no associated data
- Classes: Unnecessary complexity for simple state

**Best practices**:
- Always pattern match on `kind` field
- Use type guards for narrowing
- Never use `any` or type assertions
- Include reason/message for debugging

## Integration Points

### Existing Code Modifications

1. **src/index.ts**: Update app initialization flow
   - Call detectInitialLocation() before map creation
   - Pass detected location or fallback to initializeMap()
   - Handle permission states with user notifications

2. **src/core/map.ts**: Accept initial center parameter
   - Make `center` parameter dynamic instead of hardcoded RIGA_CENTER
   - Calculate initial zoom based on location accuracy if available

3. **src/features/data/fetch.ts**: Add bounds parameter
   - Modify fetchWaterPoints to accept optional bounds
   - Inject bbox into Overpass query template
   - Maintain backward compatibility with existing callers

4. **src/features/location/geolocation.ts**: Add initial detection
   - Extract common logic from locateUser() function
   - Add detectInitialLocation() for page load
   - Return Result type for consistent error handling

5. **src/features/markers/markers.ts**: Add nearest marker logic
   - Calculate distances when adding markers
   - Apply special styling to nearest marker
   - Update when user location changes

### New Modules

1. **src/utils/geometry.ts**: Geospatial calculations
   - haversineDistance() function
   - findNearestPoint() helper
   - Unit tests with known coordinates

2. **src/features/navigation/navigation.ts**: Map event handlers
   - setupMapNavigationHandlers() function
   - Movement significance detection
   - Debouncing logic

## Performance Considerations

- **Location detection**: 10s timeout prevents indefinite waiting
- **API calls**: Debounced (300ms) + movement threshold (25%) prevents excessive requests
- **Distance calculations**: O(n) where n = points in viewport (typically <200)
- **Memory**: No persistent storage, positions garbage collected
- **Bundle size**: +2KB for geometry utilities (negligible)

## Security & Privacy

- Location data never stored or transmitted beyond Overpass API bbox
- Clear permission request with explanation before accessing location
- No tracking or analytics of user position
- Works without location permission (falls back to Riga)
- Respects browser's secure context requirements (HTTPS)

## Testing Strategy

- **Unit tests**: Distance calculations, bounds utilities, permission state handling
- **Integration tests**: Mock geolocation API, test full flow from detection to marker display
- **Edge cases**: Permission denied, timeout, no points in area, slow network
- **Performance tests**: Verify <3s location detection, <2s refresh goals

## Open Questions

None - all technical decisions resolved.

## References

- [MDN: Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [Leaflet: Map Events](https://leafletjs.com/reference.html#map-event)
- [Overpass API: Bounding Box Queries](https://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide#Bounding_box)
- [Haversine Formula](https://en.wikipedia.org/wiki/Haversine_formula)

