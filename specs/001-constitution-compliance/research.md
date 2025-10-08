# Research & Spike: Constitution Compliance Refactoring

**Date**: 2024
**Phase**: Phase 0 - Research & Validation

## Current State Analysis

### Compilation Status

TypeScript compilation **FAILS** with 14 errors:

1. **Missing export**: `Overpass` type not exported from `types/overpass.ts` (has `Welcome` instead)
2. **Type indexing error**: `colourMap` access with dynamic string key
3. **Property access errors**: `__bound`, `message`, `key`, `click` on DOM elements
4. **Missing functions**: `parseOsmDoc()` and `loadPointsXml()` not defined
5. **Wrong async/await usage**: `fetchWater()` has completely broken type and logic
6. **Undefined variable**: `water` referenced but never defined

### Build Status

**Vite build SUCCEEDS** despite TypeScript errors (155KB bundle, 45KB gzipped). This suggests Vite is not running strict TypeScript checks during build.

### Current Functionality (Manual Testing Required)

Based on code analysis, the application should:
- Display Leaflet map centered on Riga
- Load water tap points (but functions are missing!)
- Show circular markers with colors based on tags
- Display popups with water tap information
- Provide navigation button to open maps
- Geolocation feature to show user location
- Service worker for offline support

**CRITICAL**: The `initPoints()` IIFE calls non-existent functions, so the app likely doesn't show any markers currently!

## Technical Spikes

### Spike 1: Fix Overpass Type Export

**Problem**: Import uses `Overpass` but type file exports `Welcome`

**Solution**: Either rename `Welcome` to `Overpass` or export both names

```typescript
// Option 1: Rename
export type Overpass = {
  readonly version: number;
  readonly generator: string;
  readonly osm3s: Osm3S;
  readonly elements: Element[];
};

// Option 2: Export alias
export type Overpass = Welcome;
```

**Decision**: Use Option 1 (rename) - more intuitive naming

### Spike 2: Result Type Implementation

**Created**: Basic Result<T, E> ADT structure

```typescript
export type Result<T, E> = 
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'error'; readonly error: E };

export const Ok = <T, E = never>(value: T): Result<T, E> => ({
  kind: 'ok',
  value,
});

export const Err = <T = never, E = unknown>(error: E): Result<T, E> => ({
  kind: 'error',
  error,
});

export const isOk = <T, E>(result: Result<T, E>): result is Extract<Result<T, E>, { kind: 'ok' }> => {
  return result.kind === 'ok';
};

export const isErr = <T, E>(result: Result<T, E>): result is Extract<Result<T, E>, { kind: 'error' }> => {
  return result.kind === 'error';
};
```

**Validation**: ✅ Type compiles correctly, discriminated union works as expected

### Spike 3: Leaflet Type Generics

**Research Findings**:
- `L.FeatureGroup` is generic: `L.FeatureGroup<P extends L.Layer>`
- `L.CircleMarker` extends `L.Layer`
- Correct type: `L.FeatureGroup<L.CircleMarker>`

**Validation**: ✅ This eliminates the `any` type while maintaining type safety

### Spike 4: Module Extraction Test

**Test**: Extract `escapeHtml` to separate module

```typescript
// src/utils/html.ts
export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// src/index.ts
import { escapeHtml } from './utils/html';
```

**Validation**: ✅ Module imports work correctly with Vite

### Spike 5: Type Guard Pattern

**Pattern**: Safe DOM element access

```typescript
function isHTMLElement(el: Element | null): el is HTMLElement {
  return el !== null && el instanceof HTMLElement;
}

function getRequiredAttribute(el: Element, name: string): string | null {
  return el.getAttribute(name);
}

// Usage
const navBtn = popupEl.querySelector(".navigate-btn");
if (navBtn) {
  const lat = getRequiredAttribute(navBtn, "data-lat");
  const lon = getRequiredAttribute(navBtn, "data-lon");
  if (lat && lon) {
    openNavigation(lat, lon, label);
  }
}
```

**Validation**: ✅ Eliminates unsafe type assertions

## Hidden Dependencies & Side Effects

### Global State

1. **Map instance**: `map` is global, accessed by multiple functions
2. **Layers**: `pointsLayer` is global
3. **Controls**: `locateControl` added to global map

### Side Effects

1. **IIFE execution**: `initPoints()` runs immediately on load
2. **Service worker registration**: Happens on module load
3. **setTimeout hack**: Keyboard accessibility setup uses setTimeout
4. **Event listeners**: Added dynamically in popup handlers

### Implicit Behaviors

1. **Data source**: Expects `points.xml` file (commented out import)
2. **Network requests**: `fetchWater()` function defined but never called
3. **Error handling**: Uses `alert()` which blocks UI

## Risk Assessment

### High Risk

1. **Broken functionality**: `parseOsmDoc()` and `loadPointsXml()` don't exist
   - **Impact**: App likely shows no markers currently
   - **Mitigation**: Implement these functions immediately in Phase 2

2. **Type safety violations**: 14 TypeScript errors
   - **Impact**: Runtime errors possible, type system ineffective
   - **Mitigation**: Fix all errors before refactoring

### Medium Risk

1. **Global state refactoring**: Breaking changes to module structure
   - **Impact**: Could break working features
   - **Mitigation**: Extract one module at a time, test after each

2. **Alert removal**: Users expect certain error feedback
   - **Impact**: Could confuse users if errors are silent
   - **Mitigation**: Implement notifications before removing alerts

### Low Risk

1. **Result type adoption**: Adding new abstraction
   - **Impact**: Learning curve, more verbose code
   - **Mitigation**: Document patterns, start with one module

2. **Test infrastructure**: Adding new tooling
   - **Impact**: Build time increase, complexity
   - **Mitigation**: Tests are optional, don't block features

## Findings Summary

### Critical Issues (Must Fix Immediately)

1. ✅ Missing `Overpass` type export
2. ✅ Missing `parseOsmDoc()` and `loadPointsXml()` functions
3. ✅ Broken `fetchWater()` function
4. ✅ Undefined `water` variable
5. ✅ Type assertions without guards
6. ✅ `any` types in FeatureGroup

### Technical Validation

- ✅ Result<T, E> ADT pattern works correctly
- ✅ Module extraction is straightforward
- ✅ Leaflet types support proper generics
- ✅ Type guards eliminate unsafe assertions
- ✅ Vite handles TypeScript imports correctly

### Adjustments to Plan

**No major changes needed**, but prioritize:

1. **Phase 2 must fix broken functions first** - app currently non-functional
2. **Add tsconfig check to build** - Vite ignores TypeScript errors
3. **Consider keeping fetchWater for future** - it's defined but unused
4. **Document data source** - points.xml import is commented out

## Decision: Proceed with Implementation

✅ **All technical approaches validated**
✅ **Risks identified and mitigated**
✅ **Critical issues understood**

**Recommendation**: Proceed to Phase 1 (Design) and Phase 2 (Critical Fixes)

## Next Steps

1. Complete Phase 1: Design type system contracts
2. Implement missing functions in Phase 2
3. Fix all TypeScript errors before refactoring
4. Extract modules incrementally with testing after each
5. Add `tsc --noEmit` to build process to catch errors

## Technical Constraints Discovered

1. **Vite configuration**: Need to add TypeScript checking to build
2. **Data loading**: Need to clarify data source (XML file, API, or both?)
3. **Leaflet types**: Some DOM manipulations need type guards
4. **Event types**: Keyboard events need proper typing

## Performance Notes

- Current bundle: 155KB (45KB gzipped) - reasonable for a map app
- Main bundle includes all Leaflet code - consider code splitting later
- No obvious performance issues in code structure

## Conclusion

The project is **ready for refactoring** with the following caveats:

1. Must implement missing functions immediately (app is broken)
2. Must fix all TypeScript errors before structural changes
3. Must test manually after each phase
4. Must add TypeScript checking to build pipeline

Estimated timeline remains **2-3 weeks** as planned.
