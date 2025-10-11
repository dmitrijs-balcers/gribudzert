# Quickstart: Public and Accessible Toilet Search Implementation

**Feature**: 004-public-toilet-search  
**Date**: 2025-10-12

## Overview

This guide provides step-by-step instructions for implementing the public toilet search feature while cleaning up the existing water tap code to be more generic and maintainable.

## Implementation Strategy

### Three-Phase Approach

1. **Phase A: Refactor for Generalization** - Extract generic marker logic without breaking existing functionality
2. **Phase B: Add Toilet Support** - Implement toilet-specific logic using the new generic infrastructure
3. **Phase C: Wire Everything Together** - Integrate toilet layer into the main application

---

## Phase A: Refactor Existing Code (Code Cleanup)

### Step 1: Create New Type Definitions

**File**: `src/types/facilities.ts` (new)

Copy type definitions from `specs/004-public-toilet-search/contracts/facilities.ts` to production code.

**Action**:
```bash
cp specs/004-public-toilet-search/contracts/facilities.ts src/types/facilities.ts
```

**Update imports**: Change relative paths to use src/ structure.

---

### Step 2: Extract Marker Styling Configuration

**File**: `src/features/markers/styling.ts` (new)

Extract styling logic from `markers.ts` into dedicated module:

**What to extract**:
- Color determination logic (currently `getWaterSourceColor`)
- Radius determination (currently `getMarkerRadius`)
- Opacity logic (currently `isSeasonalMarker`)
- Create generic `MarkerStyle` type

**Function signatures**:
```typescript
export function getWaterMarkerStyle(element: Element, options?: StyleOptions): MarkerStyle;
export function getToiletMarkerStyle(element: Element, options?: StyleOptions): MarkerStyle;
export function createGenericMarker(lat: number, lon: number, style: MarkerStyle): L.CircleMarker | L.Marker;
```

**Benefits**:
- Separates styling concerns from marker creation
- Makes water-specific logic explicit
- Provides template for toilet styling

---

### Step 3: Refactor markers.ts

**File**: `src/features/markers/markers.ts`

**Changes**:
1. Import `MarkerStyle` and styling functions from `./styling.ts`
2. Simplify `createMarker` to use `getWaterMarkerStyle` + `createGenericMarker`
3. Keep existing `addMarkers` function signature unchanged (no breaking changes!)
4. Extract crossed-out marker logic into `styling.ts`

**Before** (conceptual):
```typescript
function createMarker(element) {
  // 50 lines of water-specific color/radius logic
  return L.circleMarker([...], { color, radius, ... });
}
```

**After**:
```typescript
function createMarker(element, isNearest = false) {
  const style = getWaterMarkerStyle(element, { isNearest });
  return createGenericMarker(element.lat, element.lon, style);
}
```

**Validation**: Run existing tests to ensure no regression.

---

### Step 4: Generalize Data Fetching

**File**: `src/features/data/fetch.ts`

**Changes**:
1. Rename `fetchWaterPoints` → `fetchFacilities` (keep old name as alias for compatibility)
2. Rename `fetchWaterPointsInBounds` → `fetchFacilitiesInBounds` (keep alias)
3. Update JSDoc comments to be facility-agnostic

**Example**:
```typescript
/**
 * Fetch facilities from Overpass API based on map bounds
 * @param query - Overpass QL query string with [bbox] placeholder
 * @param bounds - Leaflet LatLngBounds for the visible map area
 * @returns Result with elements or fetch error
 */
export async function fetchFacilitiesInBounds(
  query: string,
  bounds: L.LatLngBounds
): Promise<Result<Element[], FetchError>> {
  // ... existing implementation
}

// Backward compatibility alias
export const fetchWaterPointsInBounds = fetchFacilitiesInBounds;
```

---

## Phase B: Add Toilet Support

### Step 5: Create Toilet Overpass Query

**File**: `src/oql/public_toilets.overpassql` (new)

```overpassql
[out:json][timeout:25];
// gather results for public toilets
(
  node["amenity"="toilets"]["access"~"yes|public|permissive"]([bbox]);
  way["amenity"="toilets"]["access"~"yes|public|permissive"]([bbox]);
  relation["amenity"="toilets"]["access"~"yes|public|permissive"]([bbox]);
);
// print results
out body;
>;
out skel qt;
```

**Import in TypeScript**:
```typescript
import publicToilets from './oql/public_toilets.overpassql?raw';
```

---

### Step 6: Add Toilet Transformers

**File**: `src/features/data/transformers.ts` (new)

Copy from `specs/004-public-toilet-search/contracts/transformers.ts` with import path adjustments.

**Key functions**:
- `elementToWaterFacility(element: Element): WaterFacility`
- `elementToToiletFacility(element: Element): ToiletFacility`

---

### Step 7: Add Toilet Styling

**File**: `src/features/markers/styling.ts` (continued from Step 2)

Implement `getToiletMarkerStyle`:

```typescript
export function getToiletMarkerStyle(
  element: Element,
  options: StyleOptions = {}
): MarkerStyle {
  const accessibility = extractAccessibility(element);
  const details = extractToiletDetails(element);
  
  // Accessible toilets get darker brown
  const fillColor = accessibility.wheelchair === 'yes'
    ? FacilityColors.toilet.accessible
    : FacilityColors.toilet.standard;
  
  return createMarkerStyle({
    fillColor,
    radius: accessibility.wheelchair === 'yes' ? MarkerRadius.wheelchair : MarkerRadius.default,
    fillOpacity: options.isSeasonal ? 0.3 : 0.6,
    color: options.isNearest ? FacilityColors.ui.nearest : '#333',
    weight: options.isNearest ? 3 : 2,
  });
}
```

---

### Step 8: Add Toilet Popup Content

**File**: `src/features/markers/popup.ts`

Add function to generate toilet popup content:

```typescript
export function createToiletPopupContent(facility: ToiletFacility): string {
  const { element, accessibility, details } = facility;
  const name = element.tags.name || 'Public Toilet';
  
  // Build accessibility info
  const wheelchairInfo = accessibility.wheelchair === 'yes' ? '✓ Wheelchair accessible' :
                        accessibility.wheelchair === 'no' ? '✗ Not wheelchair accessible' :
                        accessibility.wheelchair === 'limited' ? '~ Limited accessibility' :
                        'Accessibility information unavailable';
  
  const changingTableInfo = accessibility.changingTable === 'yes' ? '✓ Baby changing table' :
                           accessibility.changingTable === 'no' ? '✗ No changing table' :
                           'Changing table information unavailable';
  
  // Build details
  const feeInfo = details.fee === 'yes' ? 'Fee required' :
                 details.fee === 'no' ? 'Free' :
                 'Fee information unavailable';
  
  const hoursInfo = details.openingHours || '24/7 (assumed)';
  
  const unisexInfo = details.unisex === true ? 'Unisex' :
                    details.unisex === false ? 'Gendered' :
                    'Type information unavailable';
  
  return `
    <div class="popup-content">
      <h3>${escapeHtml(name)}</h3>
      <p><strong>Type:</strong> ${unisexInfo}</p>
      <p><strong>Access:</strong> ${feeInfo}</p>
      <p><strong>Hours:</strong> ${escapeHtml(hoursInfo)}</p>
      <hr>
      <p>${wheelchairInfo}</p>
      <p>${changingTableInfo}</p>
      <p class="coordinates">
        ${element.lat.toFixed(6)}, ${element.lon.toFixed(6)}
      </p>
    </div>
  `;
}
```

Update `createPopupContent` to be generic:
```typescript
export function createPopupContent(facility: Facility): string {
  if (isWaterFacility(facility)) {
    return createWaterPopupContent(facility);
  }
  if (isToiletFacility(facility)) {
    return createToiletPopupContent(facility);
  }
  return 'Unknown facility type';
}
```

---

## Phase C: Integration

### Step 9: Update Main Application Logic

**File**: `src/index.ts`

**Changes**:

1. **Add toilet query import**:
```typescript
import publicToilets from './oql/public_toilets.overpassql?raw';
```

2. **Create separate layers**:
```typescript
const waterLayer: L.FeatureGroup<L.CircleMarker> = L.featureGroup().addTo(map);
const toiletLayer: L.FeatureGroup<L.CircleMarker> = L.featureGroup(); // Hidden by default
```

3. **Update layer control**:
```typescript
L.control.layers(undefined, {
  'Water taps': waterLayer,
  'Public toilets': toiletLayer
}, { collapsed: false }).addTo(map);
```

4. **Add layer event listeners**:
```typescript
map.on('overlayadd', (e: L.LayersControlEvent) => {
  if (e.name === 'Public toilets') {
    loadToilets(map, toiletLayer, userLocation);
  }
});

map.on('overlayremove', (e: L.LayersControlEvent) => {
  if (e.name === 'Public toilets') {
    toiletLayer.clearLayers();
  }
});
```

5. **Create `loadToilets` function** (parallel to `loadWaterPoints`):
```typescript
async function loadToilets(
  map: L.Map,
  toiletLayer: L.FeatureGroup<L.CircleMarker>,
  userLocation: { lat: number; lon: number } | null,
  bounds?: L.LatLngBounds
): Promise<void> {
  showLoading(200);
  
  const fetchBounds = bounds || map.getBounds();
  const result = await fetchFacilitiesInBounds(publicToilets, fetchBounds);
  
  hideLoading();
  
  if (!isOk(result)) {
    showNotification('Failed to load toilets. Please try again.', 'error', 5000);
    return;
  }
  
  const elements = result.value;
  const facilities = elements.map(elementToToiletFacility);
  
  toiletLayer.clearLayers();
  addToiletMarkers(facilities, toiletLayer, map, userLocation);
}
```

6. **Update navigation handlers** to refetch toilets on pan/zoom:
```typescript
setupMapNavigationHandlers(map, async (bounds: L.LatLngBounds) => {
  await loadWaterPoints(map, waterLayer, userLocation, bounds);
  
  // Also refetch toilets if layer is visible
  if (map.hasLayer(toiletLayer)) {
    await loadToilets(map, toiletLayer, userLocation, bounds);
  }
});
```

---

### Step 10: Create Toilet Marker Helper

**File**: `src/features/markers/markers.ts`

Add parallel function to `addMarkers`:

```typescript
/**
 * Add toilet markers to a layer
 */
export function addToiletMarkers(
  facilities: ToiletFacility[],
  layer: L.FeatureGroup<L.CircleMarker>,
  map: L.Map,
  userLocation: { lat: number; lon: number } | null = null
): void {
  layer.clearLayers();
  
  let nearestFacility: ToiletFacility | null = null;
  
  if (userLocation) {
    nearestFacility = findNearestFacility(facilities, userLocation);
  }
  
  for (const facility of facilities) {
    const isNearest = facility === nearestFacility;
    const style = getToiletMarkerStyle(facility.element, { isNearest });
    const marker = createGenericMarker(
      facility.element.lat,
      facility.element.lon,
      style
    );
    
    if (marker) {
      const popupContent = createToiletPopupContent(facility);
      marker.bindPopup(popupContent);
      attachPopupHandlers(marker, map, facility.element);
      marker.addTo(layer);
    }
  }
}
```

---

## Testing Checklist

### Unit Tests
- [ ] Test `elementToToiletFacility` transformer with various tag combinations
- [ ] Test `getToiletMarkerStyle` returns correct colors for accessible/standard toilets
- [ ] Test accessibility parsing (wheelchair, changing_table tags)
- [ ] Test fee and hours parsing

### Integration Tests
- [ ] Test toilet layer toggle (show/hide)
- [ ] Test toilet markers appear when layer enabled
- [ ] Test toilet popup displays correct information
- [ ] Test pan/zoom refetches toilet data
- [ ] Test water layer still works correctly (no regression)

### Manual Testing
- [ ] Enable toilet layer - markers should appear in brown/tan colors
- [ ] Disable toilet layer - markers should disappear
- [ ] Click toilet marker - popup should show accessibility info
- [ ] Pan map - both water and toilet markers should update
- [ ] Deny location permission - both layers should still work with fallback

---

## Code Cleanup Summary

### Files Created
- `src/types/facilities.ts` - Facility type definitions
- `src/features/markers/styling.ts` - Extracted styling logic
- `src/features/data/transformers.ts` - Element-to-facility transformers
- `src/oql/public_toilets.overpassql` - Toilet Overpass query

### Files Modified
- `src/features/markers/markers.ts` - Refactored to use generic styling
- `src/features/markers/popup.ts` - Added toilet popup content
- `src/features/data/fetch.ts` - Renamed functions (with aliases)
- `src/index.ts` - Added toilet layer management

### Backward Compatibility
- All existing water tap functionality preserved
- Old function names aliased for compatibility
- No breaking changes to public APIs

---

## Performance Considerations

1. **Combined Queries**: When both layers are enabled, consider combining Overpass queries into a single request
2. **Marker Clustering**: If map becomes cluttered, add clustering in future iteration
3. **Caching**: Consider caching fetched data to avoid redundant API calls

---

## Future Enhancements

- Accessibility filter (custom L.Control with checkbox)
- Marker clustering for dense areas
- Offline support with service workers
- User-submitted reports for closed/broken facilities

