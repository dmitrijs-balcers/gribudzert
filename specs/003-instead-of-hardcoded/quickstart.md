# Quickstart Guide: Location-Based Map Initialization

**Date**: 2025-10-10  
**Feature**: [spec.md](./spec.md) | [plan.md](./plan.md)

## Overview

This guide helps developers understand and implement the location-based map initialization feature. It covers the key changes, testing approach, and integration points.

## What's Changing

### Before (Hardcoded Riga)
```typescript
// Map always centered on Riga
const map = L.map('map', {
  center: [56.9496, 24.1052], // Hardcoded Riga coordinates
  zoom: 13,
});

// Water points fetched for Riga area only
const result = await fetchWaterPoints(drinkingWater);
```

### After (Dynamic Location)
```typescript
// Detect user location first
const locationResult = await detectInitialLocation();
const center = isOk(locationResult) 
  ? [locationResult.value.coords.latitude, locationResult.value.coords.longitude]
  : RIGA_CENTER; // Fallback

const map = L.map('map', { center, zoom: 13 });

// Fetch water points for visible area
const bounds = map.getBounds();
const result = await fetchWaterPointsInBounds(drinkingWater, bounds);

// Identify nearest point
const nearest = findNearestWaterPoint(
  center[0], center[1], 
  result.value
);
```

## Key Components

### 1. Location Detection (`src/features/location/geolocation.ts`)

**New Function**: `detectInitialLocation()`

```typescript
/**
 * Detects user location on initial page load
 * Returns Result type for type-safe error handling
 */
export async function detectInitialLocation(): Promise<
  Result<GeolocationPosition, LocationError>
> {
  // Check if geolocation is supported
  if (!navigator.geolocation) {
    return {
      kind: 'error',
      error: {
        type: 'not-supported',
        message: 'Geolocation not supported in this browser',
      },
    };
  }

  // Wrap callback-based API in Promise
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ kind: 'success', value: position }),
      (error) => resolve({ kind: 'error', error: mapGeolocationError(error) }),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}
```

**Usage**:
```typescript
const result = await detectInitialLocation();

if (isOk(result)) {
  const { latitude, longitude, accuracy } = result.value.coords;
  // Use location
} else {
  // Handle error, fall back to Riga
  showNotification(`Location unavailable: ${result.error.message}`, 'warning');
}
```

### 2. Bounds-Based Fetching (`src/features/data/fetch.ts`)

**Modified Function**: `fetchWaterPoints()` → `fetchWaterPointsInBounds()`

```typescript
/**
 * Fetches water points within specified geographic bounds
 */
export async function fetchWaterPointsInBounds(
  query: string,
  bounds: L.LatLngBounds
): Promise<Result<Element[], FetchError>> {
  // Convert Leaflet bounds to Overpass bbox format
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  
  // Inject bbox into query (assumes query has [bbox] placeholder)
  const boundedQuery = query.replace('[bbox]', bbox);
  
  // Existing fetch logic...
  return fetchFromOverpass(boundedQuery);
}
```

**Query Template Update** (`src/oql/drinking_water.overpassql`):
```overpassql
[out:json][timeout:25];
(
  node["amenity"="drinking_water"][bbox];
  way["amenity"="drinking_water"][bbox];
);
out body;
>;
out skel qt;
```

### 3. Distance Calculations (`src/utils/geometry.ts`)

**New Module**: Geospatial utility functions

```typescript
/**
 * Calculates distance between two points using Haversine formula
 * @returns Distance in meters
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Finds nearest water point to user location
 */
export function findNearestWaterPoint(
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

### 4. Map Navigation (`src/features/navigation/navigation.ts`)

**New Module**: Handles map movement events

```typescript
/**
 * Sets up handlers for map pan/zoom events with debouncing
 */
export function setupMapNavigationHandlers(
  map: L.Map,
  onBoundsChange: (bounds: L.LatLngBounds) => void,
  options: { debounceMs?: number; threshold?: number } = {}
): () => void {
  const { debounceMs = 300, threshold = 0.25 } = options;
  let lastFetchBounds: L.LatLngBounds | null = null;
  let debounceTimer: number | null = null;

  const handler = () => {
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = window.setTimeout(() => {
      const newBounds = map.getBounds();

      if (!lastFetchBounds || hasMovedSignificantly(lastFetchBounds, newBounds, threshold)) {
        lastFetchBounds = newBounds;
        onBoundsChange(newBounds);
      }
    }, debounceMs);
  };

  map.on('moveend', handler);

  // Return cleanup function
  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    map.off('moveend', handler);
  };
}

/**
 * Determines if map has moved enough to warrant refetch
 */
function hasMovedSignificantly(
  oldBounds: L.LatLngBounds,
  newBounds: L.LatLngBounds,
  threshold: number
): boolean {
  const oldCenter = oldBounds.getCenter();
  const newCenter = newBounds.getCenter();

  const distance = haversineDistance(
    oldCenter.lat,
    oldCenter.lng,
    newCenter.lat,
    newCenter.lng
  );

  const viewportDiagonal = haversineDistance(
    oldBounds.getSouth(),
    oldBounds.getWest(),
    oldBounds.getNorth(),
    oldBounds.getEast()
  );

  return distance > viewportDiagonal * threshold;
}
```

## Integration in Main App (`src/index.ts`)

### Updated Initialization Flow

```typescript
async function initializeApp(): Promise<void> {
  try {
    // 1. Detect user location with loading indicator
    showLoading(200);
    const locationResult = await detectInitialLocation();
    
    let center: L.LatLngTuple;
    let userLocation: LocationCoordinates | null = null;

    if (isOk(locationResult)) {
      // Success: use user location
      const { latitude, longitude, accuracy } = locationResult.value.coords;
      center = [latitude, longitude];
      userLocation = { latitude, longitude, accuracy };
      logger.info(`Location detected: ${latitude}, ${longitude}`);
    } else {
      // Failure: fall back to Riga
      center = rigaLatLng;
      showNotification(
        'Could not detect your location. Showing Riga area.',
        'info',
        5000
      );
      logger.warn(`Location detection failed: ${locationResult.error.message}`);
    }

    // 2. Initialize map with determined center
    const map = L.map('map', {
      center,
      zoom: defaultZoom,
      zoomControl: true,
    });

    L.tileLayer(tileLayerUrl, {
      maxZoom: maxZoom,
      attribution: osmAttribution,
    }).addTo(map);

    L.control.scale({ metric: true, imperial: false }).addTo(map);

    // 3. Fetch water points for current viewport
    const bounds = map.getBounds();
    const pointsResult = await fetchWaterPointsInBounds(drinkingWater, bounds);

    hideLoading();

    if (!isOk(pointsResult)) {
      showNotification('Failed to load water points.', 'error', 0);
      return;
    }

    const points = pointsResult.value;

    // 4. Find nearest point if we have user location
    let nearestPoint: Element | null = null;
    if (userLocation) {
      nearestPoint = findNearestWaterPoint(
        userLocation.latitude,
        userLocation.longitude,
        points
      );
    }

    // 5. Add markers to map
    const pointsLayer: L.FeatureGroup<L.CircleMarker> = L.featureGroup().addTo(map);
    addMarkers(points, pointsLayer, map, nearestPoint);

    // 6. Setup navigation handlers for dynamic refetching
    setupMapNavigationHandlers(map, async (newBounds) => {
      showLoading(200);
      const newPointsResult = await fetchWaterPointsInBounds(drinkingWater, newBounds);
      hideLoading();

      if (isOk(newPointsResult)) {
        pointsLayer.clearLayers();
        addMarkers(newPointsResult.value, pointsLayer, map);
      }
    });

    // 7. Add locate control (existing functionality)
    setupLocateControl(map);

    logger.info(`Successfully loaded ${points.length} water points`);
  } catch (error) {
    hideLoading();
    showNotification('An unexpected error occurred.', 'error', 0);
    logger.error('App initialization error:', error);
  }
}
```

## Testing

### Unit Tests

**Test Distance Calculations** (`tests/unit/utils/geometry.test.ts`):
```typescript
import { describe, it, expect } from 'vitest';
import { haversineDistance, findNearestWaterPoint } from '@/utils/geometry';

describe('haversineDistance', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistance(56.9496, 24.1052, 56.9496, 24.1052)).toBe(0);
  });

  it('calculates distance accurately', () => {
    // ~1.1km north of Riga center
    const distance = haversineDistance(56.9496, 24.1052, 56.9596, 24.1052);
    expect(distance).toBeCloseTo(1112, -1); // Within 10m
  });
});

describe('findNearestWaterPoint', () => {
  it('returns null for empty array', () => {
    expect(findNearestWaterPoint(56.9496, 24.1052, [])).toBeNull();
  });

  it('finds nearest point', () => {
    const points = [
      { lat: 56.95, lon: 24.10, id: 1, tags: {} },
      { lat: 56.949, lon: 24.105, id: 2, tags: {} }, // Closer
      { lat: 56.96, lon: 24.12, id: 3, tags: {} },
    ];
    const nearest = findNearestWaterPoint(56.9496, 24.1052, points);
    expect(nearest?.id).toBe(2);
  });
});
```

**Test Location Detection** (`tests/unit/features/geolocation.test.ts`):
```typescript
import { describe, it, expect, vi } from 'vitest';
import { detectInitialLocation } from '@/features/location/geolocation';

describe('detectInitialLocation', () => {
  it('returns success when permission granted', async () => {
    const mockPosition = {
      coords: { latitude: 56.9496, longitude: 24.1052, accuracy: 20 },
      timestamp: Date.now(),
    };

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((success) => success(mockPosition)),
      },
    });

    const result = await detectInitialLocation();
    expect(result.kind).toBe('success');
    expect(result.value.coords.latitude).toBe(56.9496);
  });

  it('returns error when permission denied', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((_, error) =>
          error({ code: 1, message: 'User denied' })
        ),
      },
    });

    const result = await detectInitialLocation();
    expect(result.kind).toBe('error');
    expect(result.error.type).toBe('permission-denied');
  });
});
```

### Integration Tests

**Test Full Location Flow** (`tests/integration/location-flow.test.ts`):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initializeApp } from '@/index';

describe('Location-based initialization', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
  });

  it('centers map on user location when granted', async () => {
    // Mock successful location detection
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((success) =>
          success({
            coords: { latitude: 51.5074, longitude: -0.1278, accuracy: 20 },
            timestamp: Date.now(),
          })
        ),
      },
    });

    await initializeApp();

    const map = document.querySelector('#map');
    expect(map).toBeTruthy();
    // Assert map center is London, not Riga
  });

  it('falls back to Riga when permission denied', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((_, error) =>
          error({ code: 1, message: 'User denied' })
        ),
      },
    });

    await initializeApp();

    const map = document.querySelector('#map');
    expect(map).toBeTruthy();
    // Assert map center is Riga
  });
});
```

## Performance Checklist

- [ ] Location detection timeout set to 10s
- [ ] Map movement events debounced (300ms)
- [ ] Refetch only when >25% viewport movement
- [ ] Loading indicators delayed by 200ms
- [ ] Distance calculations cached when possible

## Accessibility Checklist

- [ ] Location permission request has clear explanation
- [ ] Error messages are screen reader friendly
- [ ] Fallback to Riga maintains full functionality
- [ ] Locate button remains keyboard accessible
- [ ] Loading states announced to screen readers

## Migration Path

1. **Phase 1**: Add new functions without breaking existing code
2. **Phase 2**: Update `index.ts` to use new initialization flow
3. **Phase 3**: Test with mock locations in different cities
4. **Phase 4**: Deploy and monitor location detection success rate

## Troubleshooting

### Location not detected
- Verify HTTPS or localhost (required for geolocation)
- Check browser console for permission errors
- Ensure timeout is not too short (10s recommended)

### Water points not loading
- Check Overpass query has `[bbox]` placeholder
- Verify bounds calculation: `console.log(map.getBounds())`
- Test with known coordinates in urban area

### Performance issues
- Increase debounce delay (300ms → 500ms)
- Increase movement threshold (25% → 50%)
- Reduce MAX_ZOOM to limit data volume

## Next Steps

After implementing this feature:
1. Monitor location detection success rate in analytics
2. Consider caching last location in sessionStorage
3. Add "detect location" button for manual retry
4. Implement background location updates for moving users

