# gribudzert Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-12

## Active Technologies
- TypeScript 5.9.2 / ES2020 + Leaflet 1.9.4 (mapping library), Vite 7.1.9 (bundler) (003-instead-of-hardcoded)
- Overpass API for OpenStreetMap data queries (004-public-toilet-search)

## Project Structure
```
backend/
frontend/
tests/
```

## Commands
npm test [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] npm run lint

## Code Style
TypeScript 5.9.2 / ES2020: Follow standard conventions

## Recent Changes
- 003-instead-of-hardcoded: Added TypeScript 5.9.2 / ES2020 + Leaflet 1.9.4 (mapping library), Vite 7.1.9 (bundler)
- 004-public-toilet-search: Added discriminated unions for facility types, generic marker styling system

<!-- MANUAL ADDITIONS START -->
## Architectural Patterns (004-public-toilet-search)

### Discriminated Unions for Facility Types
Use discriminated unions with `kind` field for different facility types:
```typescript
type Facility = 
  | { kind: 'water'; element: Element; drinkable: boolean }
  | { kind: 'toilet'; element: Element; accessibility: ToiletAccessibility };
```

### Generic Marker Styling
Separate styling logic from marker creation:
- `MarkerStyle` type for visual configuration
- `getWaterMarkerStyle(element, options): MarkerStyle` for water-specific styling
- `getToiletMarkerStyle(element, options): MarkerStyle` for toilet-specific styling
- `createGenericMarker(lat, lon, style): L.Marker` for generic marker creation

### Layer Management
- Multiple feature groups for different facility types
- Leaflet layer controls for show/hide functionality
- Event listeners for `overlayadd` and `overlayremove` to manage data fetching
- Default visibility: water visible, toilets hidden

### Code Organization
- `src/types/facilities.ts` - Discriminated union types for all facilities
- `src/features/markers/styling.ts` - Extracted styling logic (color, radius, opacity)
- `src/features/data/transformers.ts` - Element-to-facility transformation functions
- `src/oql/*.overpassql` - Separate query files per facility type
<!-- MANUAL ADDITIONS END -->
