# Research: Public and Accessible Toilet Search

**Feature**: 004-public-toilet-search  
**Date**: 2025-10-12

## Research Questions & Findings

### Q1: What is the standard OpenStreetMap tagging scheme for public toilets?

**Decision**: Use `amenity=toilets` as primary tag

**Rationale**:
- Standard OSM tag for public toilets is `amenity=toilets`
- Distinguishes from private toilets (`access=private` vs `access=yes/public`)
- Well-established tagging scheme with extensive data coverage globally

**Key Tags to Query**:
```
amenity=toilets + access=yes/public/permissive (public toilets)
```

**Relevant Attributes**:
- `wheelchair=yes/no/limited` - Wheelchair accessibility
- `changing_table=yes/no` - Baby changing facilities
- `fee=yes/no` - Payment required
- `opening_hours=*` - Operating hours or `24/7`
- `toilets:disposal=flush/pitlatrine/chemical` - Type
- `unisex=yes/no` - Unisex or gendered
- `male=yes/no`, `female=yes/no` - Gender availability

**Alternatives Considered**:
- `toilets:*` subtags - too granular for initial implementation
- Building-specific toilets - out of scope (requires indoor mapping)

---

### Q2: How should accessibility data be structured and validated?

**Decision**: Create `ToiletAccessibility` branded type with validation

**Rationale**:
- Follows existing domain.ts pattern with branded types
- Accessibility is critical information - needs strong typing
- OSM uses `yes/no/limited` values - map to enum for type safety

**Type Structure**:
```typescript
type WheelchairAccess = 'yes' | 'no' | 'limited' | 'unknown';
type ChangingTable = 'yes' | 'no' | 'unknown';

type ToiletAccessibility = {
  readonly wheelchair: WheelchairAccess;
  readonly changingTable: ChangingTable;
};
```

**Validation Rules**:
- Missing tags default to `'unknown'` (not `null`)
- Display "Information not available" in UI for unknown values
- Filter for accessible toilets only includes `wheelchair=yes`

**Alternatives Considered**:
- Boolean flags - loses "limited" and "unknown" states
- String literals without type - no compile-time safety

---

### Q3: What is the best approach for refactoring marker creation to be facility-agnostic?

**Decision**: Extract marker creation into generic factory with facility-specific styling

**Rationale**:
- Current `markers.ts` is tightly coupled to water-specific logic (isDrinkable, water source types)
- Need clean separation: generic marker creation + facility-specific styling
- Composition over inheritance - use strategy pattern for styling

**Refactoring Strategy**:

1. **Extract Generic Marker Factory**:
   - `createFacilityMarker(coords, style, options)` - creates L.CircleMarker or L.Marker
   - Takes styling config, returns marker instance
   - No facility-specific logic

2. **Facility-Specific Style Functions**:
   - `getWaterSourceStyle(element): MarkerStyle` - water tap styling
   - `getToiletStyle(element): MarkerStyle` - toilet styling
   - Returns color, radius, opacity, icon

3. **Discriminated Union for Facilities**:
```typescript
type Facility = 
  | { kind: 'water'; element: Element; drinkable: boolean }
  | { kind: 'toilet'; element: Element; accessible: boolean };
```

4. **Single Entry Point**:
   - `addMarkersToLayer(facilities, layer, map)` - handles both types
   - Pattern matches on `kind` to apply appropriate styling

**Benefits**:
- Clear separation of concerns
- Easy to add new facility types (e.g., showers, lockers)
- Testable in isolation
- Follows constitution principle: composition over inheritance

**Migration Path**:
- Keep existing `addMarkers` function working for water
- Create new generic `addFacilityMarkers` function
- Refactor water logic to use generic factory
- Add toilet logic using same pattern
- Remove duplicated code

---

### Q4: Should filters be implemented as layer controls or separate UI components?

**Decision**: Use Leaflet layer controls for initial implementation

**Rationale**:
- Leaflet's built-in layer control handles show/hide elegantly
- Consistent with existing "Water taps" layer control
- Zero additional UI dependencies
- Accessibility filter can be added later as custom control

**Implementation**:
```typescript
const waterLayer = L.featureGroup();
const toiletLayer = L.featureGroup();

L.control.layers(undefined, {
  'Water taps': waterLayer,
  'Public toilets': toiletLayer
}, { collapsed: false }).addTo(map);
```

**For Accessibility Filter** (P2 priority):
- Create custom L.Control extending Leaflet control
- Checkbox UI: "Show only accessible toilets"
- Filter applied client-side on existing toilet markers
- OR: Modify Overpass query to fetch only wheelchair=yes

**Alternatives Considered**:
- Custom React/Vue component - introduces framework dependency (rejected)
- HTML form outside map - less integrated, harder to style
- Query-level filtering - better performance but less flexible

**Best Practice**: Start with layer control (P1), add custom accessibility control in future iteration (P2)

---

## Technology Stack Decisions

### No New Dependencies Required

All requirements can be met with existing stack:
- TypeScript 5.9.2 - ADTs and branded types
- Leaflet 1.9.4 - Layer controls, markers, popups
- Vite 7.1.9 - No build changes needed
- Overpass API - Supports toilet queries

---

## Overpass Query Strategy

### Decision: Create Separate Query Files, Combine at Runtime

**Query Files**:
1. `src/oql/drinking_water.overpassql` - existing water query
2. `src/oql/public_toilets.overpassql` - new toilet query

**Runtime Strategy**:
```typescript
// When both layers enabled:
const combinedQuery = `
${drinkingWaterQuery}
${publicToiletsQuery}
`;

// When only one layer enabled:
const query = waterEnabled ? drinkingWaterQuery : toiletQuery;
```

**Rationale**:
- Flexibility: Can query independently or together
- Performance: Combined query when both needed (fewer HTTP requests)
- Maintainability: Separate files easier to edit
- Rate limiting: Single request when possible

**Overpass Query for Toilets**:
```overpassql
[out:json][timeout:25];
(
  node["amenity"="toilets"]["access"~"yes|public|permissive"]([bbox]);
  way["amenity"="toilets"]["access"~"yes|public|permissive"]([bbox]);
  relation["amenity"="toilets"]["access"~"yes|public|permissive"]([bbox]);
);
out body;
>;
out skel qt;
```

---

## Code Cleanup Strategy

### Areas to Refactor

1. **markers.ts** - Extract generic marker factory
2. **fetch.ts** - Rename `fetchWaterPoints` to `fetchFacilities` (keep alias for compat)
3. **popup.ts** - Make content generation facility-agnostic
4. **index.ts** - Generalize layer management logic

### Refactoring Principles

- **No Breaking Changes**: Existing water functionality must work unchanged
- **Incremental**: Refactor in small, testable steps
- **Type-Safe**: Use discriminated unions throughout
- **DRY**: Eliminate duplication between water and toilet logic

### Files to Create

- `src/oql/public_toilets.overpassql` - Toilet query
- `src/types/facilities.ts` - Facility discriminated union types
- `src/features/markers/styling.ts` - Extracted styling logic

### Files to Modify

- `src/features/markers/markers.ts` - Refactor to use generic factory
- `src/features/markers/popup.ts` - Add toilet popup content
- `src/index.ts` - Add toilet layer management
- `src/types/domain.ts` - Add toilet accessibility types

---

## Summary

All research questions resolved. Ready to proceed to Phase 1 (Data Model & Contracts).

**Key Takeaways**:
- Use OSM standard `amenity=toilets` with access filters
- Discriminated unions for facility types
- Generic marker factory with facility-specific styling strategies
- Leaflet layer controls for show/hide, custom control for accessibility filter
- No new dependencies required
- Significant code cleanup opportunity in markers.ts

