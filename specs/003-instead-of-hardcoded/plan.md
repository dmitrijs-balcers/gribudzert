# Implementation Plan: Location-Based Map Initialization

**Branch**: `003-instead-of-hardcoded` | **Date**: 2025-10-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-instead-of-hardcoded/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Transform the water point finder application from using hardcoded Riga coordinates to automatically detecting user location and centering the map based on their position. The system will fetch water points dynamically based on the visible map viewport, identify the nearest water point to the user, and gracefully fall back to Riga when location services are unavailable. This extends the existing geolocation feature (locate button) to work on initial page load and integrates with dynamic data fetching based on map bounds.

## Technical Context

**Language/Version**: TypeScript 5.9.2 / ES2020  
**Primary Dependencies**: Leaflet 1.9.4 (mapping library), Vite 7.1.9 (bundler)  
**Storage**: N/A (API-based, no persistent storage)  
**Testing**: Vitest 2.1.8 with happy-dom, @testing-library/dom for DOM testing  
**Target Platform**: Modern web browsers (Chrome, Firefox, Safari, Edge) via HTTPS or localhost  
**Project Type**: Single-page web application  
**Performance Goals**: 
  - Location detection < 3 seconds (90% of cases)
  - Water points refresh < 2 seconds after map movement
  - First meaningful paint < 1.5 seconds  
**Constraints**: 
  - Geolocation API requires secure context (HTTPS or localhost)
  - Overpass API rate limits apply
  - Must work without JavaScript for core content (progressive enhancement)
  - 80% test coverage minimum  
**Scale/Scope**: 
  - Single feature enhancement to existing app
  - ~5 files to modify, ~2 new utility functions
  - Works globally (not Riga-specific)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Code Quality & Maintainability ✓
- Feature enhances existing geolocation functionality - clear, focused purpose
- Separates concerns: location detection, map initialization, data fetching
- No inheritance required; composition-based approach fits existing codebase

### Strict Typing ✓
- All TypeScript strict options already enabled in tsconfig.json
- Will use discriminated unions for location permission states
- Result<T, E> types for error handling (already in use)
- No `any` types will be introduced

### Algebraic Data Types (ADTs) ✓
- LocationPermissionState: discriminated union (granted | denied | unavailable | pending)
- Result types for async operations with typed errors
- Immutable data structures with `readonly` modifiers
- Explicit error handling with `Result<Location, LocationError>`

### User Experience Consistency ✓
- Loading states with 200ms delay (already implemented in codebase)
- Accessible error messages for permission denial
- Keyboard navigation maintained for locate button (already implemented)
- Progressive enhancement: fallback to Riga maintains functionality
- Respects user preferences for location sharing

### Testing & Quality Assurance ✓
- Will maintain 80% coverage threshold
- Integration tests for location detection flow
- Unit tests for viewport bounds calculation
- Mock geolocation API for deterministic tests
- Edge case tests: permission denial, timeout, no water points

### Error Handling ✓
- Result types for location detection failures
- Graceful fallback to default location
- User-friendly error messages at system boundaries
- Never silent failures - all errors logged and communicated

### Performance & Scalability ✓
- Meets performance goals: <3s location, <2s refresh
- Debounce map movement events to prevent excessive API calls
- Lazy-load water points only for visible viewport
- No bundle size impact (uses existing APIs)

### Security & Privacy ✓
- Requests location permission with clear explanation
- No storage of location data (ephemeral use only)
- HTTPS requirement for geolocation API (platform standard)
- Validates all API responses before rendering

**GATE RESULT**: ✅ PASS - No constitutional violations. Feature aligns with all core principles.

## Project Structure

### Documentation (this feature)

```
specs/003-instead-of-hardcoded/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── location-api.ts  # TypeScript interfaces for location detection
└── checklists/
    └── requirements.md  # Specification validation checklist
```

### Source Code (repository root)

```
src/
├── core/
│   ├── config.ts        # [MODIFY] Add location detection config
│   └── map.ts           # [MODIFY] Update map initialization logic
├── features/
│   ├── data/
│   │   └── fetch.ts     # [MODIFY] Add bounds-based fetching
│   ├── location/
│   │   └── geolocation.ts  # [MODIFY] Add initial location detection
│   ├── markers/
│   │   └── markers.ts   # [MODIFY] Add nearest marker calculation
│   └── navigation/
│       └── navigation.ts  # [NEW] Map movement event handlers
├── types/
│   ├── domain.ts        # [MODIFY] Add location permission types
│   └── platform.ts      # [MODIFY] Add geolocation result types
└── utils/
    └── geometry.ts      # [NEW] Distance calculations, bounds utilities

tests/
├── unit/
│   ├── features/
│   │   ├── geolocation.test.ts    # [MODIFY] Add init location tests
│   │   └── navigation.test.ts     # [MODIFY] Add viewport tests
│   └── utils/
│       └── geometry.test.ts       # [NEW] Test distance/bounds functions
└── integration/
    └── location-flow.test.ts      # [NEW] End-to-end location detection
```

**Structure Decision**: Single-project web application structure. This is a feature enhancement to the existing water point finder app. All changes are localized to the `src/` directory with corresponding tests in `tests/`. The feature extends existing modules (`geolocation.ts`, `map.ts`, `fetch.ts`) and adds new utility functions for geometry calculations and map navigation event handling. No new top-level directories are needed.

## Complexity Tracking

*No violations - this section intentionally left empty.*

The feature requires no justification as it adheres to all constitutional principles without exceptions.

---

## Phase 0: Research - COMPLETED ✅

All technical unknowns have been resolved. See [research.md](./research.md) for detailed findings.

**Key Decisions Made**:
1. **Geolocation API**: Use browser native API with 10s timeout and fallback
2. **Dynamic Fetching**: Overpass API bbox parameter derived from Leaflet bounds
3. **Distance Calculation**: Haversine formula for finding nearest water point
4. **Event Handling**: Leaflet `moveend` with 300ms debounce and 25% movement threshold
5. **State Management**: Discriminated unions for type-safe permission states

---

## Phase 1: Design & Contracts - COMPLETED ✅

All design artifacts have been generated:

### Generated Artifacts

1. **[data-model.md](./data-model.md)**: Complete data model with 5 core entities
   - User Location
   - Map Viewport
   - Water Point (extended with distance fields)
   - Location Permission State
   - Location Error

2. **[contracts/location-api.ts](./contracts/location-api.ts)**: TypeScript interface contracts
   - Location detection interfaces
   - Map initialization interfaces
   - Distance calculation interfaces
   - Navigation event handler interfaces
   - Complete type safety for all feature components

3. **[quickstart.md](./quickstart.md)**: Developer implementation guide
   - Before/after code comparison
   - Key component implementations
   - Testing strategies
   - Integration examples
   - Troubleshooting guide

### Agent Context Updated

GitHub Copilot instructions have been updated with:
- TypeScript 5.9.2 / ES2020
- Leaflet 1.9.4 (mapping library), Vite 7.1.9 (bundler)
- Single-page web application project type

---

## Post-Design Constitution Check ✅

**Re-evaluation after Phase 1 design completion:**

### Code Quality & Maintainability ✓
- Contracts demonstrate clear separation of concerns
- Each function has single responsibility (detectInitialLocation, findNearestWaterPoint, etc.)
- No complex inheritance hierarchies introduced
- Functions are composable and testable

### Strict Typing ✓
- All contracts use explicit TypeScript interfaces
- No `any` types in contracts
- Discriminated unions properly defined with `readonly` fields
- Generic constraints appropriately applied

### Algebraic Data Types (ADTs) ✓
- LocationPermissionState: proper discriminated union with `kind` discriminator
- LocationError: proper discriminated union with `type` discriminator
- All state transitions are type-safe and exhaustive
- Immutability enforced with `readonly` modifiers throughout

### User Experience Consistency ✓
- Loading states properly handled (200ms delay)
- Error messages are user-friendly and actionable
- Fallback strategy ensures app never breaks
- Progressive enhancement maintained

### Testing & Quality Assurance ✓
- Test strategy documented in quickstart.md
- Unit tests for all utility functions
- Integration tests for location flow
- Mock strategies defined for geolocation API
- Coverage targets maintained (80%+)

### Error Handling ✓
- All async operations return Result<T, E> types
- Error states explicitly modeled in discriminated unions
- No silent failures in design
- Graceful degradation to fallback location

### Performance & Scalability ✓
- Debouncing prevents excessive API calls (300ms)
- Movement threshold prevents unnecessary refetches (25%)
- Distance calculation is O(n) where n is typically <200 points
- No memory leaks (cleanup functions provided)

### Security & Privacy ✓
- Location data is ephemeral (not stored)
- Permission requested with clear explanation
- Falls back gracefully when permission denied
- No sensitive data in contracts

**FINAL GATE RESULT**: ✅ PASS - Design maintains constitutional compliance. All principles upheld.

---

## Implementation Readiness

### Files to Create
- `src/utils/geometry.ts` - Distance calculations
- `src/features/navigation/navigation.ts` - Map event handlers
- `tests/unit/utils/geometry.test.ts` - Geometry tests
- `tests/integration/location-flow.test.ts` - Integration tests

### Files to Modify
- `src/index.ts` - Update initialization flow
- `src/core/map.ts` - Accept dynamic center parameter
- `src/features/data/fetch.ts` - Add bounds parameter
- `src/features/location/geolocation.ts` - Add initial detection function
- `src/features/markers/markers.ts` - Add nearest marker logic
- `src/types/domain.ts` - Add location permission types
- `src/types/platform.ts` - Add geolocation result types
- `src/oql/drinking_water.overpassql` - Add [bbox] placeholder

### Dependencies
No new dependencies required - all functionality uses existing libraries:
- Leaflet 1.9.4 (already installed)
- Browser Geolocation API (native)
- Vitest 2.1.8 (already installed for testing)

---

## Next Steps

This implementation plan is now complete. Proceed to task breakdown with:

```bash
/speckit.tasks
```

This will generate `tasks.md` with concrete implementation tasks based on this plan, research, data model, and contracts.
