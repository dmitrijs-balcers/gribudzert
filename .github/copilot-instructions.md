# gribudzert Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-02

## Active Technologies
- TypeScript 5.9.2 / ES2020 + Leaflet 1.9.4 (mapping library), Vite 7.1.9 (bundler) (003-instead-of-hardcoded)
- Overpass API for OpenStreetMap data queries (004-public-toilet-search)
- Umami Cloud for analytics (005-umami-metrics)

## Project Structure
```
src/
├── analytics/        # Self-contained analytics module
├── core/
├── features/
├── types/
├── ui/
└── utils/
tests/
```

## Commands
npm test
npm run lint

## Code Style
TypeScript 5.9.2 / ES2020: Follow standard conventions

## Recent Changes
- 003-instead-of-hardcoded: Added TypeScript 5.9.2 / ES2020 + Leaflet 1.9.4 (mapping library), Vite 7.1.9 (bundler)
- 004-public-toilet-search: Added discriminated unions for facility types, generic marker styling system
- 005-umami-metrics: Added self-contained analytics module with Umami integration

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

## Architectural Patterns (005-umami-metrics)

### Self-Contained Analytics Module
The analytics module is fully decoupled from the application:
- Located in `src/analytics/`
- Has ZERO dependencies on app modules (one-way dependency only)
- Accepts only simple primitives (no Leaflet types, no Element types)
- Fire-and-forget pattern: all functions return void and never throw

### Discriminated Unions for Events
Use discriminated unions with `kind` field for all analytics events:
```typescript
type AnalyticsEvent =
  | { kind: 'map_loaded'; locationType: 'user' | 'default' }
  | { kind: 'marker_clicked'; facilityType: 'water' | 'toilet' }
  | { kind: 'layer_enabled'; layerName: string; activeLayerCount: number };
```

### Graceful Failure Pattern
Analytics must never affect app functionality:
- Check `window.umami` existence before every call
- Wrap all calls in try-catch
- Respect Do Not Track preference
- Silent failure - no errors propagated to application

### Public API Pattern
Only export from index.ts:
```typescript
// ✅ Import from public API
import { trackMapLoaded } from '../analytics';

// ❌ Never import from internal files
import { safeTrack } from '../analytics/tracker';
```

### Event Naming Convention
Use snake_case for event names (Umami convention):
- `map_loaded`, `marker_clicked`, `navigation_started`
- `layer_enabled`, `layer_disabled`
- `locate_requested`, `locate_success`, `locate_failed`
- `area_explored`, `empty_area`
<!-- MANUAL ADDITIONS END -->
