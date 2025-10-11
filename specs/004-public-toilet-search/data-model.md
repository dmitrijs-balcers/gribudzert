# Data Model: Public and Accessible Toilet Search

**Feature**: 004-public-toilet-search  
**Date**: 2025-10-12

## Entity Definitions

### 1. Facility (Discriminated Union)

**Purpose**: Represent either a water source or toilet facility with type-safe discrimination

```typescript
type Facility = 
  | WaterFacility
  | ToiletFacility;

type WaterFacility = {
  readonly kind: 'water';
  readonly element: Element; // From Overpass API
  readonly drinkable: boolean;
  readonly sourceType: WaterSourceType;
};

type ToiletFacility = {
  readonly kind: 'toilet';
  readonly element: Element; // From Overpass API
  readonly accessibility: ToiletAccessibility;
  readonly details: ToiletDetails;
};
```

**Validation Rules**:
- `kind` field is discriminator - enables exhaustive pattern matching
- All fields are `readonly` (immutability)
- Must have valid coordinates in `element`

**State Transitions**: Immutable - no state changes after creation

---

### 2. ToiletAccessibility

**Purpose**: Strongly-typed accessibility features

```typescript
type WheelchairAccess = 'yes' | 'no' | 'limited' | 'unknown';
type ChangingTable = 'yes' | 'no' | 'unknown';

type ToiletAccessibility = {
  readonly wheelchair: WheelchairAccess;
  readonly changingTable: ChangingTable;
};
```

**Validation Rules**:
- Missing OSM tags default to `'unknown'`
- Only `wheelchair: 'yes'` qualifies for accessibility filter
- `'limited'` indicates partial accessibility (e.g., narrow doorways)

**Derived Values**:
- `isAccessible(accessibility): boolean` - returns `wheelchair === 'yes'`

---

### 3. ToiletDetails

**Purpose**: Additional toilet information for display

```typescript
type ToiletDetails = {
  readonly fee: FeeStatus;
  readonly openingHours: string | null; // null if not specified
  readonly unisex: boolean | null; // null if not specified
};

type FeeStatus = 'yes' | 'no' | 'unknown';
```

**Validation Rules**:
- `fee` defaults to `'unknown'` if tag missing
- `openingHours` can be `null` (assume 24/7) or time string
- `unisex` null means information unavailable

---

### 4. WaterSourceType (Existing, Enhanced)

**Purpose**: Categorize water sources for styling

```typescript
type WaterSourceType = 
  | 'drinking_water'  // amenity=drinking_water
  | 'spring'          // natural=spring
  | 'water_well'      // man_made=water_well
  | 'water_tap'       // man_made=water_tap
  | 'water_point'     // waterway=water_point
  | 'unknown';
```

**Validation Rules**:
- Derived from `element.tags` (existing logic)
- Used for color mapping

---

### 5. MarkerStyle

**Purpose**: Generic marker styling configuration (new abstraction)

```typescript
type MarkerStyle = {
  readonly color: string;        // Hex color code
  readonly fillColor: string;    // Hex color code
  readonly radius: number;       // Pixels
  readonly weight: number;       // Border width
  readonly fillOpacity: number;  // 0-1
  readonly iconType?: 'circle' | 'crossed' | 'custom'; // Marker shape variant
};
```

**Validation Rules**:
- Colors must be valid hex codes (#RRGGBB)
- radius > 0, weight > 0
- fillOpacity between 0 and 1

---

### 6. LayerState

**Purpose**: Track visibility and loading state of facility layers

```typescript
type LayerState = {
  readonly water: LayerInfo;
  readonly toilet: LayerInfo;
};

type LayerInfo = {
  readonly visible: boolean;    // Layer checkbox state
  readonly loading: boolean;    // Fetching data
  readonly error: string | null; // Error message if fetch failed
};
```

**State Transitions**:
- `visible: false → true` triggers data fetch (if not cached)
- `loading: true` while fetch in progress
- `error: null → string` if fetch fails
- `visible: true → false` hides markers (doesn't clear data)

---

## Relationships

```
Facility (discriminated union)
  ├─ WaterFacility
  │   ├─ Element (Overpass data)
  │   ├─ drinkable: boolean
  │   └─ sourceType: WaterSourceType
  │
  └─ ToiletFacility
      ├─ Element (Overpass data)
      ├─ accessibility: ToiletAccessibility
      └─ details: ToiletDetails

MarkerStyle
  ├─ Used by WaterFacility styling
  └─ Used by ToiletFacility styling

LayerState
  ├─ water: LayerInfo
  └─ toilet: LayerInfo
```

---

## Data Flow

```
1. User enables layer → LayerState.visible = true
2. Fetch Overpass data → Element[]
3. Transform to Facility union → WaterFacility[] | ToiletFacility[]
4. Apply styling → (Facility, MarkerStyle)
5. Create markers → L.CircleMarker[]
6. Add to layer → L.FeatureGroup
```

---

## Type Guards & Helpers

```typescript
// Type guard for discriminated union
function isWaterFacility(facility: Facility): facility is WaterFacility {
  return facility.kind === 'water';
}

function isToiletFacility(facility: Facility): facility is ToiletFacility {
  return facility.kind === 'toilet';
}

// Accessibility checker
function isAccessible(accessibility: ToiletAccessibility): boolean {
  return accessibility.wheelchair === 'yes';
}

// Element to Facility transformers
function elementToWaterFacility(element: Element): WaterFacility;
function elementToToiletFacility(element: Element): ToiletFacility;
```

---

## Validation Rules Summary

| Entity | Field | Rule |
|--------|-------|------|
| Facility | kind | Must be 'water' or 'toilet' |
| Facility | element | Must have valid lat/lon |
| ToiletAccessibility | wheelchair | Must be enum value or 'unknown' |
| ToiletAccessibility | changingTable | Must be enum value or 'unknown' |
| ToiletDetails | fee | Must be enum value or 'unknown' |
| ToiletDetails | openingHours | String or null |
| MarkerStyle | color/fillColor | Must be valid hex code |
| MarkerStyle | radius/weight | Must be > 0 |
| MarkerStyle | fillOpacity | Must be 0-1 |

---

## Migration Strategy

### Phase 1: Add New Types (Non-Breaking)
- Add `Facility` union types to `src/types/facilities.ts`
- Add `ToiletAccessibility` and `ToiletDetails` types
- Add `MarkerStyle` type
- **No changes to existing code yet**

### Phase 2: Refactor Existing Code (Careful)
- Update `markers.ts` to use `MarkerStyle`
- Keep existing water functions working
- Add generic `createFacilityMarker` alongside existing functions

### Phase 3: Add Toilet Support
- Implement `elementToToiletFacility` transformer
- Add toilet styling functions
- Wire up toilet layer in `index.ts`

**Key Principle**: Existing water functionality must remain unchanged during refactoring

