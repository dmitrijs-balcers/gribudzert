# Data Model: Location-Based Map Initialization

**Date**: 2025-10-10  
**Feature**: [spec.md](./spec.md) | [plan.md](./plan.md)

## Overview

This document defines the data structures and their relationships for implementing automatic location detection and dynamic water point fetching.

## Core Entities

### 1. User Location

Represents the user's geographic position obtained from the browser's Geolocation API.

**Attributes**:
- `latitude: number` - Geographic latitude in decimal degrees (-90 to 90)
- `longitude: number` - Geographic longitude in decimal degrees (-180 to 180)
- `accuracy: number` - Accuracy radius in meters
- `timestamp: number` - Unix timestamp in milliseconds when position was obtained
- `altitude?: number` - Height above sea level in meters (optional)
- `altitudeAccuracy?: number` - Accuracy of altitude in meters (optional)

**Validation Rules**:
- Latitude must be between -90 and 90
- Longitude must be between -180 and 180
- Accuracy must be positive
- Timestamp must not be in the future

**Relationships**:
- Used to center the map on initial load
- Used to calculate nearest water point
- Passed to viewport bounds calculation

**State Transitions**:
```
null → pending → (granted | denied | timeout)
                      ↓
                  position available
```

---

### 2. Map Viewport

Represents the currently visible area of the map.

**Attributes**:
- `bounds: LatLngBounds` - Geographic bounding box of visible area
  - `north: number` - Northern latitude boundary
  - `south: number` - Southern latitude boundary
  - `east: number` - Eastern longitude boundary
  - `west: number` - Western longitude boundary
- `center: LatLng` - Center point of the viewport
  - `latitude: number`
  - `longitude: number`
- `zoom: number` - Current zoom level (0-19)

**Validation Rules**:
- North must be greater than south
- East and west wrap around at ±180°
- Zoom must be between 0 and MAX_ZOOM (19)

**Relationships**:
- Derived from Leaflet Map instance
- Used to query Overpass API for water points
- Compared with previous bounds to determine if refetch is needed

**State Transitions**:
```
Initial viewport (Riga or User Location)
    ↓
User pans/zooms
    ↓
Movement detected (moveend event)
    ↓
Bounds calculated
    ↓
Significant movement check
    ↓
(refetch if >25% change) OR (skip refetch)
```

---

### 3. Water Point

Represents a drinking water source with geographic coordinates and attributes.

**Attributes** (existing):
- `id: number | string` - OpenStreetMap element ID
- `lat: number` - Latitude in decimal degrees
- `lon: number` - Longitude in decimal degrees
- `tags: Record<string, string>` - OpenStreetMap tags
  - `amenity: 'drinking_water'`
  - `colour?: string` - Marker color
  - `bottle?: 'yes' | 'no'` - Bottle refill availability
  - `wheelchair?: 'yes' | 'no'` - Wheelchair accessibility
  - `seasonal?: 'yes' | 'no'` - Seasonal availability

**New Attributes** (added by this feature):
- `distanceFromUser?: number` - Distance in meters from user's location
- `isNearest: boolean` - Flag indicating this is the nearest point to user

**Validation Rules**:
- Latitude must be between -90 and 90
- Longitude must be between -180 and 180
- Distance must be non-negative when present
- Only one water point can have isNearest: true at a time

**Relationships**:
- Multiple water points exist within a viewport
- One water point is marked as nearest to user location
- Water points are rendered as CircleMarkers on the map

**Derived Data**:
- Marker color derived from `tags.colour` via COLOUR_MAP
- Marker radius derived from `tags.bottle` and `tags.wheelchair`
- Marker opacity derived from `tags.seasonal`

---

### 4. Location Permission State

Represents the current state of location permission and detection.

**Type Definition** (Discriminated Union):
```typescript
type LocationPermissionState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'granted'; readonly position: GeolocationPosition }
  | { readonly kind: 'denied'; readonly reason: 'user-denied' | 'unavailable' }
  | { readonly kind: 'timeout' };
```

**States**:
1. **Pending**: Location request in progress
   - UI: Show loading indicator
   - Action: Wait for browser response

2. **Granted**: User granted permission and position obtained
   - UI: Center map on position, hide loading
   - Action: Fetch water points for viewport
   - Data: Contains GeolocationPosition object

3. **Denied**: User denied permission or location unavailable
   - UI: Show fallback message, center on Riga
   - Action: Fetch water points for Riga area
   - Data: Contains reason (user-denied or unavailable)

4. **Timeout**: Location request exceeded 10s timeout
   - UI: Show timeout message, center on Riga
   - Action: Fallback to default location

**Validation Rules**:
- State must be one of the four variants
- `granted` must include valid position
- `denied` must include reason
- Transitions are one-way (no retries in this feature)

**State Transitions**:
```
App loads → pending
    ↓
navigator.geolocation.getCurrentPosition() called
    ↓
    ├─→ User grants permission → granted (with position)
    ├─→ User denies permission → denied (user-denied)
    ├─→ Location unavailable → denied (unavailable)
    └─→ 10s timeout → timeout
```

---

### 5. Location Error

Represents errors that can occur during location detection.

**Type Definition** (Discriminated Union):
```typescript
type LocationError =
  | { readonly type: 'permission-denied'; readonly message: string }
  | { readonly type: 'position-unavailable'; readonly message: string }
  | { readonly type: 'timeout'; readonly message: string }
  | { readonly type: 'not-supported'; readonly message: string };
```

**Error Types**:
1. **permission-denied**: User explicitly denied location access
2. **position-unavailable**: Device cannot determine position
3. **timeout**: Location detection exceeded time limit
4. **not-supported**: Browser doesn't support Geolocation API

**Relationships**:
- Maps from GeolocationPositionError codes to typed errors
- Used in Result<Position, LocationError> return type
- Triggers fallback behavior and user notifications

---

## Data Flow

### Initial Load Flow
```
1. App initializes
   ↓
2. Detect location (pending state)
   ↓
3a. SUCCESS: granted state with position
   → Center map on user location
   → Calculate viewport bounds
   → Fetch water points in bounds
   → Calculate nearest point
   → Render markers
   
3b. FAILURE: denied/timeout state
   → Center map on Riga (fallback)
   → Calculate viewport bounds
   → Fetch water points in bounds
   → Render markers (no nearest)
```

### Map Movement Flow
```
1. User pans or zooms map
   ↓
2. moveend event fires
   ↓
3. Debounce 300ms
   ↓
4. Calculate new viewport bounds
   ↓
5. Compare with last fetch bounds
   ↓
6a. Significant movement (>25% viewport)
   → Fetch water points in new bounds
   → Clear existing markers
   → Render new markers
   → Recalculate nearest point
   
6b. Insignificant movement
   → Skip fetch
   → Keep existing markers
```

### Nearest Point Calculation Flow
```
1. Have user location + water points
   ↓
2. For each water point:
   → Calculate Haversine distance from user
   ↓
3. Find point with minimum distance
   ↓
4. Mark point as nearest (isNearest: true)
   ↓
5. Apply special styling to nearest marker
   ↓
6. Show distance in popup
```

---

## Type System Integration

### Existing Types (to extend)
- `Element` (src/types/overpass.ts): Add optional distance and isNearest fields
- `FetchError` (src/types/errors.ts): Reuse for bounds-based fetching
- `Result<T, E>` (src/types/result.ts): Use for location detection

### New Types (to add)
- `LocationPermissionState` (src/types/platform.ts)
- `LocationError` (src/types/errors.ts)
- `LatLngBounds` (imported from leaflet)
- `GeometryUtils` (src/utils/geometry.ts): Distance calculation functions

---

## Immutability & ADT Patterns

All data structures follow project principles:

1. **Readonly fields**: All properties use `readonly` modifier
2. **Discriminated unions**: Permission states and errors use `kind`/`type` discriminator
3. **No mutation**: Map bounds are recalculated, not modified
4. **Type-safe exhaustive checking**: All state transitions covered by TypeScript compiler
5. **Result types**: All fallible operations return `Result<T, E>`

---

## Performance Considerations

- **Water points**: Typically 50-200 per viewport, distance calc is O(n)
- **Bounds comparison**: O(1) calculation for movement significance
- **Memory**: No persistent storage, objects garbage collected after use
- **Cache**: Last fetch bounds cached to avoid redundant API calls

---

## Testing Data

### Mock User Locations
```typescript
const MOCK_LOCATIONS = {
  riga: { lat: 56.9496, lon: 24.1052, accuracy: 20 },
  london: { lat: 51.5074, lon: -0.1278, accuracy: 30 },
  tokyo: { lat: 35.6762, lon: 139.6503, accuracy: 25 },
  sydney: { lat: -33.8688, lon: 151.2093, accuracy: 15 },
};
```

### Mock Viewport Bounds
```typescript
const MOCK_BOUNDS = {
  rigaCenter: {
    north: 56.9596, south: 56.9396,
    east: 24.1152, west: 24.0952,
  },
  // ~2km x 2km area
};
```

### Distance Test Cases
```typescript
// Known distances for validation
[
  { from: RIGA, to: RIGA, expected: 0 },
  { from: RIGA, to: { lat: 56.9596, lon: 24.1052 }, expected: ~1112 }, // ~1.1km north
  { from: { lat: 0, lon: 0 }, to: { lat: 0, lon: 1 }, expected: ~111319 }, // ~111km at equator
]
```

