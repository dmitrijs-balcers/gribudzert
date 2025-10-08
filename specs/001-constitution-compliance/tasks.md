# Tasks: Constitution Compliance Refactoring

**Input**: Plan from `/specs/001-constitution-compliance/plan.md`
**Prerequisites**: IMPROVEMENT_ANALYSIS.md, speckit.constitution, plan.md
**Branch**: `001-constitution-compliance`

## Format: `[ID] [P?] [Phase] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Phase]**: Phase number (P0, P1, P2, etc.)
- Include exact file paths in descriptions

## Path Conventions
Single project structure with paths at repository root: `src/`, `tests/`

---

## Phase 0: Research & Spike (2-4 hours)

**Purpose**: Validate technical approach before full implementation

**Goal**: Understand current behavior and validate key technical decisions

- [ ] T001 [P0] Document all current map features and user interactions in `specs/001-constitution-compliance/research.md`
- [ ] T002 [P0] Manually test all user flows: map load, marker click, popup, navigation button, geolocation
- [ ] T003 [P0] Research Leaflet TypeScript generics for `L.FeatureGroup<T>` and `L.CircleMarker` types
- [ ] T004 [P0] Spike: Create `src/types/result.ts` with basic Result<T, E> type and test with mock async operation
- [ ] T005 [P0] Spike: Extract one function (e.g., `escapeHtml`) to `src/utils/html.ts` and verify imports work
- [ ] T006 [P0] Document any hidden dependencies, global state usage, or side effects found
- [ ] T007 [P0] Document risk assessment and any adjustments needed to plan in `research.md`

**Checkpoint**: Review research.md findings before proceeding to Phase 1

---

## Phase 1: Design & Contracts (4-6 hours)

**Purpose**: Define all types and module contracts before implementation

**Goal**: Complete type system design and module interfaces

### Type System Design

- [ ] T008 [P] [P1] Design Result<T, E> and Option<T> ADTs in `specs/001-constitution-compliance/contracts/result-type.md`
- [ ] T009 [P] [P1] Design all error discriminated unions in `specs/001-constitution-compliance/contracts/error-types.md`
- [ ] T010 [P] [P1] Design branded domain types in `specs/001-constitution-compliance/contracts/domain-types.md`
- [ ] T011 [P] [P1] Document Platform, LocationState discriminated unions in `specs/001-constitution-compliance/data-model.md`

### Module Contracts

- [ ] T012 [P] [P1] Document config.ts exports and constants structure in `specs/001-constitution-compliance/contracts/config.md`
- [ ] T013 [P] [P1] Document map.ts interface (initialization, types, exports) in `specs/001-constitution-compliance/contracts/map.md`
- [ ] T014 [P] [P1] Document data module interfaces (fetch, parse) in `specs/001-constitution-compliance/contracts/data.md`
- [ ] T015 [P] [P1] Document UI module interfaces (notifications, loading) in `specs/001-constitution-compliance/contracts/ui.md`

### Architecture Documentation

- [ ] T016 [P1] Create module dependency graph in `specs/001-constitution-compliance/data-model.md`
- [ ] T017 [P1] Document error propagation strategy across modules in `specs/001-constitution-compliance/data-model.md`
- [ ] T018 [P1] Design notification system UI/UX (appearance, timing, accessibility) in `specs/001-constitution-compliance/contracts/ui.md`
- [ ] T019 [P1] Create developer quickstart guide in `specs/001-constitution-compliance/quickstart.md`
- [ ] T020 [P1] Define test structure and coverage targets in `specs/001-constitution-compliance/quickstart.md`

**Checkpoint**: All contracts and designs complete before implementation

---

## Phase 2: Critical Fixes - Type Foundation (Week 1: 4-6 hours)

**Purpose**: Implement ADT foundation and type infrastructure

**Goal**: Create type system that eliminates `any` and enables type-safe error handling

### ADT Implementation

- [ ] T021 [P] [P2] Create `src/types/result.ts` with Result<T, E> type, Ok/Err constructors, isOk/isErr guards, map/mapErr/flatMap helpers
- [ ] T022 [P] [P2] Create `src/types/option.ts` with Option<T> type, Some/None constructors, isSome/isNone guards, map/flatMap helpers
- [ ] T023 [P2] Add unit tests for Result type in `tests/unit/types/result.test.ts`
- [ ] T024 [P2] Add unit tests for Option type in `tests/unit/types/option.test.ts`

### Error Types

- [ ] T025 [P] [P2] Create `src/types/errors.ts` with FetchError discriminated union (network, parse, timeout)
- [ ] T026 [P] [P2] Create GeolocationError discriminated union in `src/types/errors.ts` (permission_denied, unavailable, timeout, insecure_context)
- [ ] T027 [P] [P2] Create AppError discriminated union in `src/types/errors.ts` for all app-level errors

### Domain Types

- [ ] T028 [P] [P2] Create `src/types/domain.ts` with branded types: NodeId, Latitude, Longitude, ColorCode
- [ ] T029 [P] [P2] Create Platform discriminated union in `src/types/platform.ts` (android, ios, desktop)
- [ ] T030 [P] [P2] Create LocationState discriminated union in `src/types/location.ts` (idle, loading, success, error)
- [ ] T031 [P2] Add constructors/validators for branded types in `src/types/domain.ts`

**Checkpoint**: All ADT types compile and pass tests

---

## Phase 2: Critical Fixes - Fix Broken Code (Week 1: 4-6 hours)

**Purpose**: Fix all broken function references and wrong types

**Goal**: Codebase compiles without errors

### Fix Missing Functions

- [ ] T032 [P2] Implement `parseOsmDoc()` function to parse XML and extract nodes (temporarily in index.ts, will move later)
- [ ] T033 [P2] Implement `loadPointsXml()` function to load and return XML data (temporarily in index.ts, will move later)
- [ ] T034 [P2] Fix `fetchWater()` function signature to return `Promise<Result<Element[], FetchError>>` instead of wrong type
- [ ] T035 [P2] Fix `fetchWater()` implementation to properly await and handle response in `src/index.ts`
- [ ] T036 [P2] Remove undefined `water` variable reference at line 298 in `src/index.ts`
- [ ] T037 [P2] Remove commented import on line 2 of `src/index.ts`

### Add Explicit Return Types

- [ ] T038 [P] [P2] Add return type `string` to `escapeHtml()` function in `src/index.ts`
- [ ] T039 [P] [P2] Add return type `void` to `openNavigation()` function in `src/index.ts`
- [ ] T040 [P] [P2] Add return type `void` to `addNodesToLayer()` function in `src/index.ts`
- [ ] T041 [P] [P2] Add return type `void` to `locateMe()` function in `src/index.ts`
- [ ] T042 [P] [P2] Add return types to all remaining functions without explicit types

### Remove Type Assertions

- [ ] T043 [P2] Replace `as string` type assertions in popup event handler (lines 141-142) with proper null checks
- [ ] T044 [P2] Add type guard `isHTMLElement()` for DOM queries and replace unsafe assertions

### Fix `any` Types

- [ ] T045 [P2] Replace `L.FeatureGroup<any>` with `L.FeatureGroup<L.CircleMarker>` on line 32 in `src/index.ts`
- [ ] T046 [P2] Replace `L.FeatureGroup<any>` parameter with `L.FeatureGroup<L.CircleMarker>` on line 82 in `src/index.ts`
- [ ] T047 [P2] Audit entire codebase for remaining `any` types and eliminate them

**Checkpoint**: `yarn tsc --noEmit` passes with zero errors, zero `any` types

---

## Phase 3: Modular Refactoring - Extract Utilities (Week 2: 3-4 hours)

**Purpose**: Extract pure utility functions (safest to extract first)

**Goal**: Create reusable utility modules with full test coverage

- [ ] T048 [P] [P3] Create `src/utils/html.ts` and move `escapeHtml()` function with explicit return type
- [ ] T049 [P] [P3] Create `src/utils/dom.ts` with `isHTMLElement()` type guard and `getAttribute()` helper
- [ ] T050 [P] [P3] Create `src/utils/logger.ts` with `info()`, `warn()`, `error()` functions replacing console.log
- [ ] T051 [P] [P3] Create `src/core/config.ts` with `colourMap`, `rigaLatLng`, API URLs, and other constants
- [ ] T052 [P3] Update `src/index.ts` to import from utility modules
- [ ] T053 [P] [P3] Write unit test for `escapeHtml()` in `tests/unit/utils/html.test.ts` (test XSS vectors)
- [ ] T054 [P] [P3] Write unit tests for DOM utilities in `tests/unit/utils/dom.test.ts`
- [ ] T055 [P] [P3] Write unit tests for config constants in `tests/unit/core/config.test.ts`

**Checkpoint**: Utility modules tested and integrated, app still works

---

## Phase 3: Modular Refactoring - Extract Features (Week 2: 6-8 hours)

**Purpose**: Extract feature modules with clear responsibilities

**Goal**: Break 299-line index.ts into focused modules

### Navigation Feature

- [ ] T056 [P] [P3] Create `src/features/navigation/navigation.ts` and move `openNavigation()` function
- [ ] T057 [P3] Create `detectPlatform()` function returning Platform discriminated union in navigation.ts
- [ ] T058 [P3] Refactor `openNavigation()` to use `detectPlatform()` and pattern matching
- [ ] T059 [P3] Update navigation.ts to import config from `src/core/config.ts`
- [ ] T060 [P] [P3] Write unit tests for platform detection in `tests/unit/features/navigation.test.ts`

### Data Feature

- [ ] T061 [P] [P3] Create `src/features/data/fetch.ts` and move `fetchWater()` function with Result type
- [ ] T062 [P] [P3] Create `src/features/data/parser.ts` and move `parseOsmDoc()` and `loadPointsXml()` functions
- [ ] T063 [P3] Update parser.ts functions to return Result types for error handling
- [ ] T064 [P3] Add data validation in parser.ts for lat/lon bounds and required fields
- [ ] T065 [P3] Update imports in index.ts to use data modules
- [ ] T066 [P] [P3] Write unit tests for parser functions in `tests/unit/features/data/parser.test.ts`
- [ ] T067 [P3] Write integration test for data fetch in `tests/integration/data-fetch.test.ts` (mocked)

### Markers Feature

- [ ] T068 [P] [P3] Create `src/features/markers/markers.ts` and move `addNodesToLayer()` function
- [ ] T069 [P] [P3] Create `src/features/markers/popup.ts` and move popup creation logic from markers.ts
- [ ] T070 [P3] Refactor popup.ts to use navigation module for button handlers
- [ ] T071 [P3] Update markers to accept FeatureGroup with proper Leaflet types
- [ ] T072 [P3] Move Node type definition to `src/types/domain.ts` and use branded types
- [ ] T073 [P3] Update imports in index.ts to use marker modules

### Location Feature

- [ ] T074 [P] [P3] Create `src/features/location/geolocation.ts` and move `locateMe()` function
- [ ] T075 [P3] Refactor geolocation.ts to return `Result<Coordinates, GeolocationError>` instead of using alert
- [ ] T076 [P3] Update geolocation.ts to use LocationState discriminated union for state tracking
- [ ] T077 [P3] Update imports in index.ts to use geolocation module

**Checkpoint**: All features extracted, index.ts is <150 lines, app works identically

---

## Phase 3: Modular Refactoring - Extract Core (Week 2: 3-4 hours)

**Purpose**: Extract map and UI infrastructure

**Goal**: Clean entry point that orchestrates initialization

### Map Core

- [ ] T078 [P] [P3] Create `src/core/map.ts` with `initializeMap()` function returning Result<L.Map, MapError>
- [ ] T079 [P3] Move map initialization logic from index.ts to map.ts (tile layer, controls, etc.)
- [ ] T080 [P3] Move locate control setup to map.ts
- [ ] T081 [P3] Add proper error handling for map initialization failures

### UI Infrastructure

- [x] T082 [P] [P3] Create `src/ui/notifications.ts` with `showNotification(message, type)` function
- [x] T083 [P3] Implement toast/snackbar component in notifications.ts with accessibility (role="status", aria-live)
- [x] T084 [P3] Add CSS for toast notifications in index.html <style> section
- [x] T085 [P] [P3] Create `src/ui/loading.ts` with `showLoading()` and `hideLoading()` functions
- [x] T086 [P3] Implement loading spinner component in loading.ts
- [x] T087 [P3] Add CSS for loading spinner in index.html <style> section

### Entry Point Cleanup

- [x] T088 [P3] Refactor `src/index.ts` to import and orchestrate modules only (target <100 lines)
- [x] T089 [P3] Add error boundary in index.ts wrapping initialization with Result type handling
- [x] T090 [P3] Replace all remaining `alert()` calls with `showNotification()` throughout codebase
- [x] T091 [P3] Add proper error messages for all error cases using notification system

**Checkpoint**: Clean architecture, no file >150 lines, app works with better UX

---

## Phase 4: UX Improvements (Week 2: 6-8 hours)

**Purpose**: Replace alerts with proper UI and add loading states

**Goal**: Professional error handling and loading indicators

### Notification System Integration

- [x] T092 [P] [P4] Replace geolocation alerts with notifications in `src/features/location/geolocation.ts`
- [x] T093 [P] [P4] Add helpful error messages for each GeolocationError type
- [x] T094 [P4] Add notification for successful location acquisition
- [x] T095 [P4] Add notification when data fetch fails with recovery instructions

### Loading States

- [x] T096 [P4] Add loading indicator when fetching water points data in `src/index.ts`
- [x] T097 [P4] Show loading state in geolocation during position acquisition
- [x] T098 [P4] Ensure loading appears after 200ms delay to avoid flashing
- [x] T099 [P4] Hide loading spinner on success or error

### Error Boundaries

- [x] T100 [P4] Add error boundary for map initialization failure in `src/index.ts`
- [x] T101 [P4] Show helpful error message with troubleshooting steps for map init errors
- [x] T102 [P4] Add empty state handling when no water points are returned from API
- [x] T103 [P4] Show message "No water points found" with refresh option

### Accessibility Improvements

- [x] T104 [P] [P4] Add `@media (prefers-reduced-motion: reduce)` styles for animations
- [ ] T105 [P] [P4] Audit all keyboard navigation flows and document any issues
- [x] T106 [P4] Fix setTimeout hack on line 264 with proper event handling or MutationObserver
- [x] T107 [P4] Improve focus management: focus on notification when it appears, trap focus in popups
- [ ] T108 [P4] Test with screen reader and fix any accessibility issues found

**Checkpoint**: Zero `alert()` calls, loading states everywhere, accessible

---

## Phase 5: Testing Infrastructure - Setup (Week 3: 2-3 hours)

**Purpose**: Configure testing framework and tools

**Goal**: Testing environment ready for comprehensive test writing

- [ ] T109 [P5] Install testing dependencies: `yarn add -D vitest @vitest/ui @testing-library/dom happy-dom`
- [ ] T110 [P5] Create `vitest.config.ts` with configuration (environment: happy-dom, coverage options)
- [ ] T111 [P5] Create `tests/setup.ts` with global test setup and mocks
- [ ] T112 [P5] Add test scripts to package.json: `test`, `test:ui`, `test:coverage`
- [ ] T113 [P5] Configure coverage thresholds in vitest.config.ts (80% for business logic)
- [ ] T114 [P5] Create test utilities in `tests/helpers.ts` (mock factories, test data)

**Checkpoint**: `yarn test` runs successfully (even with no tests)

---

## Phase 5: Testing Infrastructure - Unit Tests (Week 3: 4-6 hours)

**Purpose**: Write comprehensive unit tests for pure functions

**Goal**: 100% coverage on pure functions, 80%+ overall

### Utility Tests (Already partially done in Phase 3, expand here)

- [ ] T115 [P] [P5] Expand `tests/unit/utils/html.test.ts` with comprehensive XSS test cases
- [ ] T116 [P] [P5] Add edge case tests for DOM utilities in `tests/unit/utils/dom.test.ts`
- [ ] T117 [P] [P5] Verify config values in `tests/unit/core/config.test.ts`

### Type System Tests

- [ ] T118 [P] [P5] Write comprehensive Result type tests in `tests/unit/types/result.test.ts` (Ok, Err, map, flatMap)
- [ ] T119 [P] [P5] Write comprehensive Option type tests in `tests/unit/types/option.test.ts` (Some, None, map, flatMap)
- [ ] T120 [P] [P5] Test branded type constructors and validators in `tests/unit/types/domain.test.ts`

### Feature Tests

- [ ] T121 [P] [P5] Write navigation tests in `tests/unit/features/navigation.test.ts` (platform detection, URL generation)
- [ ] T122 [P] [P5] Write parser tests in `tests/unit/features/data/parser.test.ts` (valid data, invalid data, edge cases)
- [ ] T123 [P] [P5] Write marker tests in `tests/unit/features/markers.test.ts` (marker creation, color selection, radius calculation)
- [ ] T124 [P] [P5] Write popup tests in `tests/unit/features/popup.test.ts` (content generation, escaping, accessibility)

### Core Tests

- [ ] T125 [P5] Write config tests verifying all constants are defined correctly
- [ ] T126 [P5] Write notification system tests in `tests/unit/ui/notifications.test.ts` (show, hide, accessibility)
- [ ] T127 [P5] Write loading indicator tests in `tests/unit/ui/loading.test.ts`

**Checkpoint**: 80%+ unit test coverage on business logic

---

## Phase 5: Testing Infrastructure - Integration Tests (Week 3: 4-5 hours)

**Purpose**: Test module interactions and user flows

**Goal**: Verify modules work together correctly

- [ ] T128 [P] [P5] Write map initialization test in `tests/integration/map-init.test.ts` (successful init, error handling)
- [ ] T129 [P] [P5] Write data fetch and render test in `tests/integration/data-fetch.test.ts` (mock API, verify markers added)
- [ ] T130 [P5] Write marker interaction test in `tests/integration/marker-interaction.test.ts` (click marker, popup opens, buttons work)
- [ ] T131 [P5] Write geolocation flow test in `tests/integration/geolocation.test.ts` (mock browser API, verify UI updates)
- [ ] T132 [P5] Write error handling integration test in `tests/integration/error-handling.test.ts` (network errors, show notifications)

**Checkpoint**: All integration tests pass, critical user flows covered

---

## Phase 6: Code Quality Tools (Week 3: 4-6 hours)

**Purpose**: Add linting and code formatting

**Goal**: Consistent code style and catch common errors

- [ ] T133 [P6] Install Biome: `yarn add -D @biomejs/biome`
- [ ] T134 [P6] Create `biome.json` config with strict TypeScript rules
- [ ] T135 [P6] Add lint scripts to package.json: `lint`, `lint:fix`, `format`
- [ ] T136 [P6] Run `yarn lint` and document all errors found
- [ ] T137 [P6] Fix all linting errors across codebase
- [ ] T138 [P6] Run `yarn format` to format all files consistently
- [ ] T139 [P6] Add `.editorconfig` for consistent editor settings
- [ ] T140 [P6] (Optional) Install husky and lint-staged for pre-commit hooks

**Checkpoint**: `yarn lint` passes with zero errors, all files formatted

---

## Phase 7: Security Enhancements (Week 4: 3-4 hours)

**Purpose**: Add security headers and validate external resources

**Goal**: Secure application following best practices

- [ ] T141 [P] [P7] Research and document required CSP directives in `specs/001-constitution-compliance/contracts/security.md`
- [ ] T142 [P7] Add Content-Security-Policy meta tag to `index.html` with appropriate directives
- [ ] T143 [P7] Test application with CSP enabled, fix any violations
- [ ] T144 [P] [P7] Generate SRI hash for Leaflet CSS from unpkg.com
- [ ] T145 [P7] Add `integrity` and `crossorigin` attributes to Leaflet CSS link in index.html
- [ ] T146 [P7] Consider bundling Leaflet CSS locally instead of CDN (copy to public/)
- [ ] T147 [P7] Review and strengthen HTML sanitization in `src/utils/html.ts`
- [ ] T148 [P7] Add input validation for all user-controlled data (lat/lon bounds, string lengths)
- [ ] T149 [P] [P7] Run `yarn audit` and address any high/critical vulnerabilities
- [ ] T150 [P7] Document security considerations in `specs/001-constitution-compliance/contracts/security.md`

**Checkpoint**: CSP implemented, SRI added, security audit clean

---

## Phase 7: Performance Optimizations (Week 4: 3-4 hours)

**Purpose**: Optimize load time and runtime performance

**Goal**: Lighthouse score 90+ across all categories

- [ ] T151 [P] [P7] Add `<link rel="preconnect" href="https://overpass-api.de">` to index.html
- [ ] T152 [P] [P7] Add `<link rel="dns-prefetch" href="https://tile.openstreetmap.org">` to index.html
- [ ] T153 [P7] Consider implementing marker clustering with Leaflet.markercluster for large datasets
- [ ] T154 [P7] Lazy-load service worker registration (don't block main thread)
- [ ] T155 [P7] Run `yarn build` and analyze bundle size with vite-bundle-visualizer
- [ ] T156 [P7] Optimize imports to avoid importing unused Leaflet modules
- [ ] T157 [P] [P7] Run Lighthouse audit and document results
- [ ] T158 [P7] Fix any Lighthouse issues with score <90
- [ ] T159 [P7] Test on slow 3G network and optimize if needed
- [ ] T160 [P7] Verify service worker caches map tiles for offline use

**Checkpoint**: Lighthouse 90+ all categories, fast on slow networks

---

## Phase 8: Documentation & Polish (Week 4: 4-6 hours)

**Purpose**: Update all documentation for new architecture

**Goal**: Clear documentation for future contributors

- [ ] T161 [P] [P8] Update README.md with new project structure and architecture overview
- [ ] T162 [P] [P8] Document development workflow in README.md (install, dev, build, test)
- [ ] T163 [P] [P8] Add architecture diagram showing module dependencies to README.md or docs/
- [ ] T164 [P] [P8] Create CONTRIBUTING.md with coding standards and PR process
- [ ] T165 [P8] Add JSDoc comments to all exported functions in public modules
- [ ] T166 [P8] Document Result/Option type usage patterns in `specs/001-constitution-compliance/quickstart.md`
- [ ] T167 [P8] Document error handling strategy in `specs/001-constitution-compliance/quickstart.md`
- [ ] T168 [P8] Create migration guide for future refactoring in `specs/001-constitution-compliance/migration.md`
- [ ] T169 [P8] Update constitution compliance checklist in `IMPROVEMENT_ANALYSIS.md`
- [ ] T170 [P8] Final review: verify all checkboxes in IMPROVEMENT_ANALYSIS.md are addressed

**Checkpoint**: Documentation complete and accurate

---

## Phase 9: CI/CD & Deployment (Optional if requested)

**Purpose**: Automate testing and deployment

**Goal**: Automated quality gates and deployment pipeline

- [ ] T171 [P] [P9] Create `.github/workflows/ci.yml` for continuous integration
- [ ] T172 [P9] Add workflow steps: install dependencies, type check, lint, test, build
- [ ] T173 [P9] Configure test coverage reporting in CI
- [ ] T174 [P9] Add branch protection rules requiring CI to pass
- [ ] T175 [P] [P9] Create `.github/workflows/deploy.yml` for deployment (if applicable)
- [ ] T176 [P9] Configure deployment to hosting platform (GitHub Pages, Netlify, Vercel, etc.)

**Checkpoint**: CI passes on all commits, automated deployment works

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0 (Research)**: No dependencies - START HERE
- **Phase 1 (Design)**: Depends on Phase 0 completion
- **Phase 2 (Critical Fixes)**: Depends on Phase 1 completion - Creates foundation
- **Phase 3 (Refactoring)**: Depends on Phase 2 completion - Uses ADT types
- **Phase 4 (UX)**: Depends on Phase 3 completion - Uses refactored modules
- **Phase 5 (Testing)**: Depends on Phase 3 completion - Can start after refactoring
- **Phase 6 (Quality)**: Can start anytime, but easier after Phase 3-4
- **Phase 7 (Security/Perf)**: Depends on Phase 3-4 completion
- **Phase 8 (Documentation)**: Depends on all implementation phases
- **Phase 9 (CI/CD)**: Depends on Phase 5-6 completion (needs tests and lint)

### Critical Path

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
                                    ↓
                          Phase 5 (Tests) → Phase 6 (Lint)
                                                ↓
                                          Phase 9 (CI/CD)
                                                
Phase 7 (Security/Perf) can run parallel with Phase 5-6
Phase 8 (Docs) runs last after everything else
```

### Parallel Opportunities

- **Within Phase 2**: T021-T031 (all type creation tasks are parallel)
- **Within Phase 3**: Utility extraction tasks (T048-T051) are parallel
- **Within Phase 3**: Feature extraction (T056-T077) can be parallel if careful with imports
- **Within Phase 5**: All unit test files can be written in parallel
- **Phase 5 & 6**: Can run in parallel after Phase 3
- **Phase 7 tasks**: Security and performance tasks mostly independent

### Task Dependencies Within Phases

**Phase 2 Critical Dependencies**:
- T021-T024 (ADT types) must complete before T032-T036 (fixing functions that use Result)
- T025-T027 (Error types) needed for T034-T035 (fetchWater fix)

**Phase 3 Critical Dependencies**:
- T048-T051 (Utilities) should complete before feature extraction
- T052 (Update index.ts imports) depends on each utility creation
- Each feature module depends on config and utility modules being ready

**Phase 5 Dependencies**:
- T109-T114 (Setup) must complete before any test writing
- Unit tests (T115-T127) can all run in parallel after setup
- Integration tests (T128-T132) should come after unit tests

---

## Testing Strategy

### Test-First Approach (Where Applicable)

For new functionality (notifications, loading), write tests first:
1. Write failing test for expected behavior
2. Implement minimum code to pass test
3. Refactor with tests as safety net

### Refactoring Safety

For extracted modules:
1. Extract module and update imports
2. Run manual tests to verify behavior unchanged
3. Write tests for the extracted module
4. Refactor further if needed with test coverage

### Coverage Targets

- **Pure functions**: 100% coverage (utils, helpers)
- **Business logic**: 80%+ coverage (features, core)
- **Integration flows**: Cover all critical user paths
- **UI components**: Test accessibility and interactions

---

## Implementation Strategy

### Recommended Execution Order

**Week 1: Foundation (16 hours)**
1. Complete Phase 0 (Research) - 4 hours
2. Complete Phase 1 (Design) - 6 hours
3. Start Phase 2 (Critical Fixes) - 6 hours

**Week 2: Refactoring (20 hours)**
1. Complete Phase 2 (Critical Fixes) - 4 hours
2. Complete Phase 3 (Refactoring) - 12 hours
3. Complete Phase 4 (UX Improvements) - 4 hours

**Week 3: Quality (18 hours)**
1. Complete Phase 5 (Testing) - 12 hours
2. Complete Phase 6 (Code Quality) - 6 hours

**Week 4: Polish (14 hours)**
1. Complete Phase 7 (Security & Performance) - 6 hours
2. Complete Phase 8 (Documentation) - 4 hours
3. Complete Phase 9 (CI/CD) - 4 hours (if needed)

**Total: 68 hours over 3-4 weeks**

### Validation Checkpoints

After each phase, validate:
- ✅ TypeScript compiles without errors (`yarn tsc --noEmit`)
- ✅ Application runs and behaves correctly (`yarn dev`)
- ✅ Tests pass if written (`yarn test`)
- ✅ No regressions in functionality

### Quality Gates

Before considering phase complete:
- **Phase 2**: Zero `any` types, zero type errors, broken code fixed
- **Phase 3**: Max 150 lines per file, clear module boundaries
- **Phase 4**: Zero alerts, loading states everywhere
- **Phase 5**: 80%+ coverage, all tests green
- **Phase 6**: Zero lint errors
- **Phase 7**: Lighthouse 90+
- **Phase 8**: All docs updated

---

## Success Metrics

**Type Safety** (After Phase 2):
- [x] 0 instances of `any` type
- [x] 100% explicit return types
- [x] 0 unsafe type assertions
- [x] All functions type-safe

**Code Quality** (After Phase 3):
- [x] No file exceeds 150 lines
- [x] Clear module boundaries
- [x] No circular dependencies
- [x] Single responsibility per module

**Testing** (After Phase 5):
- [x] 80%+ business logic coverage
- [x] 100% pure function coverage
- [x] All critical paths tested
- [x] Tests run in <5 seconds

**User Experience** (After Phase 4):
- [x] 0 alert() calls
- [x] Loading states for all async ops
- [x] Accessible error messages
- [x] Keyboard navigation works

**Performance** (After Phase 7):
- [x] Lighthouse Performance: 90+
- [x] Lighthouse Accessibility: 95+
- [x] Lighthouse Best Practices: 95+
- [x] Bundle size reasonable

---

## Notes

- **[P] tasks**: Can run in parallel (different files, no blocking dependencies)
- **Manual testing**: Required after each major phase to catch regressions
- **Incremental commits**: Commit after each logical task or small group
- **Branch strategy**: Work on `001-constitution-compliance` branch, PR to main when complete
- **Rollback safety**: Each phase leaves app in working state, can stop at any checkpoint
