# Tasks: Location-Based Map Initialization

**Input**: Plan from `/specs/003-instead-of-hardcoded/plan.md`  
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, contracts/location-api.ts, quickstart.md  
**Branch**: `003-instead-of-hardcoded`

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story reference (US1, US2, US3, US4)
- **Include exact file paths in descriptions**

## Path Conventions
Single project structure with paths at repository root: `src/`, `tests/`

---

## Phase 1: Setup & Infrastructure (1-2 hours)

**Purpose**: Prepare project configuration and verify existing codebase

**Goal**: Ensure all dependencies are in place and codebase is stable before feature work

- [x] T001 [P] Verify TypeScript 5.9.2 strict mode enabled in `tsconfig.json`
- [x] T002 [P] Verify Leaflet 1.9.4 installed and types available (`@types/leaflet`)
- [x] T003 [P] Verify Vitest 2.1.8 and @testing-library/dom installed for testing
- [x] T004 Audit existing geolocation implementation in `src/features/location/geolocation.ts`
- [x] T005 Audit existing map initialization in `src/core/map.ts` and `src/index.ts`
- [x] T006 Audit existing fetch logic in `src/features/data/fetch.ts`
- [x] T007 Run existing test suite to ensure baseline stability: `npm test`

**Checkpoint**: All dependencies verified, existing tests pass, codebase stable

---

## Phase 2: Foundational - Type System & Utilities (2-3 hours)

**Purpose**: Create foundational types and utilities needed by ALL user stories

**Goal**: Establish type-safe foundation for location detection, distance calculations, and error handling

### Type Definitions

- [x] T008 [P] [Foundation] Create LocationError discriminated union in `src/types/errors.ts` with types: permission-denied, position-unavailable, timeout, not-supported
- [x] T009 [P] [Foundation] Create LocationPermissionState discriminated union in `src/types/platform.ts` with states: pending, granted, denied, timeout
- [x] T010 [P] [Foundation] Extend Element type in `src/types/overpass.ts` to add optional `distanceFromUser?: number` and `isNearest: boolean` fields

### Geometry Utilities

- [x] T011 [P] [Foundation] Create `src/utils/geometry.ts` with `haversineDistance()` function (lat1, lon1, lat2, lon2 → meters)
- [x] T012 [Foundation] Add `findNearestWaterPoint()` function to `src/utils/geometry.ts` (userLat, userLon, points[] → Element | null)
- [x] T013 [P] [Foundation] Write unit tests for `haversineDistance()` in `tests/unit/utils/geometry.test.ts` (same point = 0, known distances)
- [x] T014 [P] [Foundation] Write unit tests for `findNearestWaterPoint()` in `tests/unit/utils/geometry.test.ts` (empty array, single point, multiple points)

### Configuration

- [x] T015 [Foundation] Add location detection config to `src/core/config.ts`: LOCATION_TIMEOUT (10000ms), LOCATION_HIGH_ACCURACY (true)

**Checkpoint**: All foundational types compile, geometry functions tested, ready for user story implementation

---

## Phase 3: User Story 1 - Automatic Location Detection (4-6 hours)

**Purpose**: Implement core feature - detect user location and center map on initial load

**Goal**: Users see map centered on their location with nearby water points

### Implementation

- [x] T016 [US1] Add `detectInitialLocation()` function to `src/features/location/geolocation.ts` returning `Promise<Result<GeolocationPosition, LocationError>>`
- [x] T017 [US1] Implement location detection logic with 10s timeout, high accuracy, and error mapping in `detectInitialLocation()`
- [x] T018 [US1] Add `mapGeolocationError()` helper in `geolocation.ts` to convert GeolocationPositionError codes to LocationError union
- [x] T019 [US1] Modify `src/core/map.ts` to accept dynamic `center: L.LatLngTuple` parameter instead of hardcoded Riga coordinates
- [x] T020 [US1] Update `src/index.ts` initialization flow: call `detectInitialLocation()` before map creation
- [x] T021 [US1] Add loading indicator in `src/index.ts` with `showLoading(200)` during location detection
- [x] T022 [US1] Handle granted state in `src/index.ts`: extract coords, pass to map initialization, hide loading
- [x] T023 [US1] Add `fetchWaterPointsInBounds()` function to `src/features/data/fetch.ts` accepting `L.LatLngBounds` parameter
- [x] T024 [US1] Modify Overpass query in `src/oql/drinking_water.overpassql` to use `[bbox]` placeholder
- [x] T025 [US1] Implement bbox injection in `fetchWaterPointsInBounds()`: convert Leaflet bounds to Overpass format (south,west,north,east)
- [x] T026 [US1] Update `src/index.ts` to call `fetchWaterPointsInBounds(query, map.getBounds())` after map initialization
- [x] T027 [US1] Add nearest point calculation in `src/index.ts`: call `findNearestWaterPoint()` if user location available
- [x] T028 [US1] Update `addMarkers()` in `src/features/markers/markers.ts` to accept optional `nearestPoint: Element | null` parameter
- [x] T029 [US1] Apply special styling to nearest marker in `markers.ts` (different color/radius/pulsing effect)
- [x] T030 [US1] Update popup content in `src/features/markers/popup.ts` to show distance when available (e.g., "150m away")

### Testing

- [ ] T031 [P] [US1] Write unit test for `detectInitialLocation()` success case in `tests/unit/features/geolocation.test.ts`
- [ ] T032 [P] [US1] Write unit test for `detectInitialLocation()` permission denied in `tests/unit/features/geolocation.test.ts`
- [ ] T033 [P] [US1] Write unit test for `detectInitialLocation()` timeout in `tests/unit/features/geolocation.test.ts`
- [ ] T034 [P] [US1] Write unit test for `mapGeolocationError()` covering all error codes in `tests/unit/features/geolocation.test.ts`
- [ ] T035 [P] [US1] Write unit test for `fetchWaterPointsInBounds()` bbox formatting in `tests/unit/features/data/fetch.test.ts`
- [ ] T036 [US1] Write integration test for location detection → map initialization flow in `tests/integration/location-flow.test.ts`
- [ ] T037 [US1] Manually test in browser: grant permission, verify map centers on user location
- [ ] T038 [US1] Manually test nearest marker highlighting and distance display

**Checkpoint**: ✅ User Story 1 Complete - Users with location permission see map centered on their position with nearby water points and nearest point highlighted

---

## Phase 4: User Story 2 - Fallback to Default Location (2-3 hours)

**Purpose**: Ensure app remains functional when location is unavailable

**Goal**: Users can access app even without location services

### Implementation

- [x] T039 [US2] Add fallback logic in `src/index.ts` for denied/timeout location states: use RIGA_CENTER constant
- [x] T040 [US2] Add user notification in `src/index.ts` when falling back: `showNotification('Could not detect your location. Showing Riga area.', 'info', 5000)`
- [x] T041 [US2] Log fallback reason using logger in `src/index.ts`: `logger.warn(\`Location detection failed: \${result.error.message}\`)`
- [x] T042 [US2] Ensure water points fetch still works with fallback location (already handled by bounds-based fetching)
- [x] T043 [US2] Ensure nearest point calculation is skipped when user location unavailable (null check in `src/index.ts`)

### Testing

- [ ] T044 [P] [US2] Write integration test for permission denied → fallback to Riga in `tests/integration/location-flow.test.ts`
- [ ] T045 [P] [US2] Write integration test for timeout → fallback to Riga in `tests/integration/location-flow.test.ts`
- [ ] T046 [P] [US2] Write integration test for not-supported → fallback to Riga in `tests/integration/location-flow.test.ts`
- [ ] T047 [US2] Manually test in browser: deny permission, verify map shows Riga with notification
- [ ] T048 [US2] Manually test in HTTP context (geolocation unavailable), verify fallback works

**Checkpoint**: ✅ User Story 2 Complete - App gracefully handles location unavailability with clear user communication

---

## Phase 5: User Story 3 - Manual Location Search (3-4 hours)

**Purpose**: Allow users to explore different areas by panning/zooming

**Goal**: Water points update dynamically as users navigate the map

### Implementation

- [x] T049 [US3] Create `src/features/navigation/navigation.ts` module for map movement handlers
- [x] T050 [US3] Implement `hasMovedSignificantly()` function in `navigation.ts`: compare bounds using haversine distance, 25% viewport threshold
- [x] T051 [US3] Implement `setupMapNavigationHandlers()` function in `navigation.ts`: attach to `moveend` event with 300ms debounce
- [x] T052 [US3] Add cleanup function return from `setupMapNavigationHandlers()` to remove event listeners and clear timers
- [x] T053 [US3] Track `lastFetchBounds` in navigation handlers to avoid redundant fetches
- [x] T054 [US3] Call `onBoundsChange` callback only when movement exceeds threshold
- [x] T055 [US3] Integrate navigation handlers in `src/index.ts`: call `setupMapNavigationHandlers()` after initial water points load
- [x] T056 [US3] Implement bounds change handler in `src/index.ts`: show loading, fetch new points, clear markers, re-render
- [x] T057 [US3] Recalculate nearest point relative to map center (not user location) when panning without location
- [x] T058 [US3] Handle case where user pans to area with no water points: show "No water points found in this area" message

### Testing

- [x] T059 [P] [US3] Write unit test for `hasMovedSignificantly()` in `tests/unit/features/navigation.test.ts` (various movement scenarios)
- [x] T060 [P] [US3] Write unit test for debouncing in `setupMapNavigationHandlers()` in `tests/unit/features/navigation.test.ts`
- [x] T061 [US3] Write integration test for pan → refetch water points in `tests/integration/location-flow.test.ts`
- [x] T062 [US3] Write integration test for zoom → refetch water points in `tests/integration/location-flow.test.ts`
- [ ] T063 [US3] Manually test: pan map 50% viewport distance, verify water points update
- [ ] T064 [US3] Manually test: pan map 10% viewport distance, verify NO refetch occurs
- [ ] T065 [US3] Manually test: zoom in/out, verify water points update appropriately
- [ ] T066 [US3] Manually test: pan to ocean/rural area, verify "no points" message displays

**Checkpoint**: ✅ User Story 3 Complete - Users can explore any area and see relevant water points with optimal refetch behavior

---

## Phase 6: User Story 4 - Re-center on Current Location (1-2 hours)

**Purpose**: Allow users to return to their current location after exploring

**Goal**: Locate button re-centers map and updates water points

### Implementation

- [ ] T067 [US4] Verify existing locate button functionality in `src/features/location/geolocation.ts` works with new bounds-based fetching
- [ ] T068 [US4] Ensure locate button triggers `moveend` event so navigation handlers automatically refetch water points
- [ ] T069 [US4] Update locate button success handler to recalculate nearest point based on new position
- [ ] T070 [US4] Ensure nearest marker highlighting updates when location changes

### Testing

- [ ] T071 [P] [US4] Write integration test for locate button → map re-centers → water points update in `tests/integration/location-flow.test.ts`
- [ ] T072 [US4] Manually test: pan away from location, click locate button, verify map re-centers and points update
- [ ] T073 [US4] Manually test: move device to new location (or mock), click locate, verify new nearest point highlighted

**Checkpoint**: ✅ User Story 4 Complete - Users can easily return to current location with updated nearby water points

---

## Phase 7: Polish & Integration (2-3 hours)

**Purpose**: Cross-cutting improvements and final quality assurance

**Goal**: Production-ready feature with excellent UX and full test coverage

### User Experience

- [ ] T074 [P] Add clear permission request explanation before geolocation prompt (informational tooltip or modal)
- [ ] T075 [P] Improve loading state messages: "Detecting your location..." vs "Loading water points..."
- [ ] T076 [P] Add accessibility labels for nearest marker (aria-label with distance)
- [ ] T077 [P] Ensure keyboard navigation works for locate button and nearest marker popup

### Performance Optimization

- [ ] T078 Check bundle size impact: should be <2KB added for geometry utilities
- [ ] T079 Verify location detection averages <3 seconds in real-world testing
- [ ] T080 Verify water points refresh averages <2 seconds after map movement
- [ ] T081 Add cancel mechanism for in-flight API requests when new movement occurs

### Error Handling & Edge Cases

- [ ] T082 [P] Add retry button in error notifications for failed water point fetches
- [ ] T083 [P] Add informative message when map bounds are too large (zoom in to see points)
- [ ] T084 [P] Handle Overpass API rate limiting with exponential backoff
- [ ] T085 Test with simulated slow network (throttling in DevTools)

### Testing & Documentation

- [ ] T086 Run full test suite and verify 80%+ coverage maintained: `npm test -- --coverage`
- [ ] T087 Fix any failing tests from feature changes
- [ ] T088 Update README.md with new location-based initialization feature description
- [ ] T089 Add troubleshooting section to README for common location issues (HTTPS requirement, permissions)
- [ ] T090 Perform cross-browser testing: Chrome, Firefox, Safari, Edge

### Code Quality

- [ ] T091 Run linter and fix any issues: `npm run lint`
- [ ] T092 Run TypeScript compiler in strict mode and verify zero errors: `npx tsc --noEmit`
- [ ] T093 Verify no `any` types were introduced during implementation
- [ ] T094 Review all error messages for user-friendliness and clarity
- [ ] T095 Add JSDoc comments to all new public functions

**Checkpoint**: ✅ Feature Complete - Production-ready with full test coverage, excellent UX, and comprehensive documentation

---

## Dependencies & Parallel Execution

### Dependency Graph (User Story Completion Order)

```
Phase 1: Setup
    ↓
Phase 2: Foundational (BLOCKS ALL USER STORIES)
    ↓
    ├─→ Phase 3: US1 (Automatic Location Detection)
    │       ↓
    ├─→ Phase 4: US2 (Fallback) - depends on US1
    │       ↓
    ├─→ Phase 5: US3 (Manual Search) - depends on US1
    │       ↓
    └─→ Phase 6: US4 (Re-center) - depends on US1, US3
            ↓
Phase 7: Polish (requires all user stories complete)
```

### Parallelizable Tasks by Phase

**Phase 2 (Foundational)**:
- T008, T009, T010 (type definitions - different files)
- T011, T013, T014 (geometry function + tests - can write tests from spec)

**Phase 3 (US1)**:
- T031, T032, T033, T034, T035 (all test files - different test cases)

**Phase 4 (US2)**:
- T044, T045, T046 (all test files - different error scenarios)

**Phase 5 (US3)**:
- T059, T060 (different test cases in same module)

**Phase 7 (Polish)**:
- T074, T075, T076, T077 (UX improvements - different concerns)
- T082, T083, T084 (error handling - different edge cases)

---

## Implementation Strategy

### MVP Scope (Minimum Viable Product)
- **Phase 1**: Setup (required)
- **Phase 2**: Foundational (required)
- **Phase 3**: User Story 1 - Automatic location detection (CORE VALUE)
- **Phase 4**: User Story 2 - Fallback to default (ESSENTIAL)

**Delivers**: Users can see water points near them OR in Riga if location unavailable. This is the minimal complete feature.

### Incremental Delivery
1. **Sprint 1** (MVP): Phases 1-4 (~10-12 hours)
2. **Sprint 2** (Enhanced): Phase 5 - Manual search (~3-4 hours)
3. **Sprint 3** (Complete): Phases 6-7 - Re-center + polish (~3-5 hours)

### Testing Approach
- Write unit tests in parallel with implementation (TDD encouraged but not required)
- Integration tests after each user story phase
- Manual testing checklist at end of each user story
- Final comprehensive testing in Phase 7

---

## Success Metrics

Upon completion, verify these success criteria from spec.md:

- [ ] **SC-001**: Users with location enabled see map centered on their location within 3 seconds (90% of cases)
- [ ] **SC-002**: Users can identify nearest water point within 5 seconds of map loading
- [ ] **SC-003**: Water points refresh within 2 seconds when panning >50% viewport distance
- [ ] **SC-004**: Location permission denial handled gracefully 100% of the time
- [ ] **SC-005**: App works in at least 3 different cities globally (test with mock locations)
- [ ] **SC-006**: 95% of users understand location permission request
- [ ] **SC-007**: App remains functional for users who deny location permission

---

## Task Summary

**Total Tasks**: 95 tasks  
**Estimated Time**: 18-25 hours total

**By Phase**:
- Phase 1 (Setup): 7 tasks (~1-2 hours)
- Phase 2 (Foundational): 8 tasks (~2-3 hours) - BLOCKS ALL USER STORIES
- Phase 3 (US1): 23 tasks (~4-6 hours) - CORE VALUE
- Phase 4 (US2): 10 tasks (~2-3 hours) - ESSENTIAL
- Phase 5 (US3): 18 tasks (~3-4 hours) - ENHANCEMENT
- Phase 6 (US4): 7 tasks (~1-2 hours) - ENHANCEMENT
- Phase 7 (Polish): 22 tasks (~2-3 hours) - QUALITY

**By User Story**:
- US1 (Automatic Location Detection): 23 implementation + 8 test tasks
- US2 (Fallback to Default): 5 implementation + 5 test tasks
- US3 (Manual Location Search): 10 implementation + 8 test tasks
- US4 (Re-center on Location): 4 implementation + 3 test tasks

**Parallel Opportunities**: 28 tasks can run in parallel within their phases

**Suggested MVP**: Phases 1-4 only (35 tasks, ~10-12 hours) delivers core value - automatic location detection with graceful fallback.
