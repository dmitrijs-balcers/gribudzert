# Tasks: Public and Accessible Toilet Search

**Feature**: 004-public-toilet-search  
**Input**: Design documents from `/specs/004-public-toilet-search/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests included per PHASE1-COMPLETE.md recommendation for TDD approach

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
Single project structure: `src/`, `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure - no new files needed, existing infrastructure sufficient

- [x] T001 Verify TypeScript 5.9.2, Leaflet 1.9.4, Vite 7.1.9 are properly configured
- [x] T002 Review existing map infrastructure (markers, popups, layer management)
- [x] T003 [P] Review existing Overpass API integration in `src/features/data/fetch.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Refactor existing water tap code to be generic and support multiple facility types

**⚠️ CRITICAL**: No user story work can begin until this phase is complete - this creates the foundation for all facility types

### Tests for Foundational Refactoring (TDD Approach)

**NOTE: Write these tests FIRST, ensure they PASS (to verify no regression)**

- [x] T004 [P] [REFACTOR] Unit test for `getWaterMarkerStyle()` in `tests/unit/features/markers/styling.test.ts`
- [x] T005 [P] [REFACTOR] Unit test for `createGenericMarker()` in `tests/unit/features/markers/styling.test.ts`
- [x] T006 [P] [REFACTOR] Integration test verifying existing water tap functionality still works in `tests/integration/water-markers.test.ts`

### Implementation for Foundational Refactoring

- [x] T007 [P] [REFACTOR] Create `src/types/facilities.ts` with discriminated union types (copy from `specs/004-public-toilet-search/contracts/facilities.ts`)
- [x] T008 [REFACTOR] Create `src/features/markers/styling.ts` with extracted styling logic:
  - Extract color determination logic from `markers.ts` → `getWaterSourceColor()`
  - Extract radius determination logic → `getMarkerRadius()`
  - Extract opacity logic for seasonal markers → `isSeasonalMarker()`
  - Create `MarkerStyle` type and export
  - Create `getWaterMarkerStyle(element, options): MarkerStyle` function
  - Create `createGenericMarker(lat, lon, style): L.CircleMarker` factory function
  - Copy color palettes and constants from `specs/004-public-toilet-search/contracts/marker-styles.ts`
- [x] T009 [REFACTOR] Refactor `src/features/markers/markers.ts` to use generic styling:
  - Import `MarkerStyle` and functions from `./styling.ts`
  - Simplify `createMarker()` to call `getWaterMarkerStyle()` + `createGenericMarker()`
  - Keep `addMarkers()` function signature unchanged for backward compatibility
  - Remove old color/radius logic (now in styling.ts)
- [x] T010 [REFACTOR] Generalize `src/features/data/fetch.ts`:
  - Rename `fetchWaterPoints` → `fetchFacilities` (keep old name as alias)
  - Rename `fetchWaterPointsInBounds` → `fetchFacilitiesInBounds` (keep alias)
  - Update JSDoc comments to be facility-agnostic
  - Keep backward compatibility - no breaking changes
- [x] T011 [REFACTOR] Run existing tests to verify no regression: `npm test`
- [x] T012 [REFACTOR] Run linter to verify code quality: `npm run lint`

**Checkpoint**: Foundation ready - existing water tap functionality still works, generic infrastructure available for new facility types

---

## Phase 3: User Story 1 - Display Public Toilets on Map (Priority: P1) 🎯 MVP

**Goal**: Users can enable a checkbox to display public toilet markers on the map, distinct from water taps. Toilets are hidden by default, visible when enabled, and update when map pans/zooms.

**Independent Test**: Load map (toilets hidden), enable toilet checkbox, verify toilet markers appear distinct from water markers, pan map to verify markers update.

### Tests for User Story 1 (TDD Approach)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T013 [P] [US1] Unit test for `elementToToiletFacility()` transformer in `tests/unit/features/data/transformers.test.ts`
- [X] T014 [P] [US1] Unit test for `getToiletMarkerStyle()` in `tests/unit/features/markers/styling.test.ts`
- [X] T015 [P] [US1] Unit test for toilet tag parsing (wheelchair, changing_table, fee) in `tests/unit/features/data/transformers.test.ts`
- [ ] T016 [US1] Integration test for toilet layer toggle (enable/disable) in `tests/integration/toilet-layer.test.ts`

### Implementation for User Story 1

- [X] T017 [P] [US1] Create `src/oql/public_toilets.overpassql` with Overpass query for `amenity=toilets` + `access=yes/public/permissive`
- [X] T018 [US1] Create `src/features/data/transformers.ts` with toilet transformation logic:
  - `elementToWaterFacility(element): WaterFacility`
  - `elementToToiletFacility(element): ToiletFacility`
  - `extractAccessibility(element): ToiletAccessibility`
  - `extractToiletDetails(element): ToiletDetails`
  - Helper functions: `parseWheelchairTag()`, `parseChangingTableTag()`, `parseFeeTag()`, `parseUnisexTag()`
  - Copy logic from `specs/004-public-toilet-search/contracts/transformers.ts`
- [X] T019 [US1] Add `getToiletMarkerStyle()` function to `src/features/markers/styling.ts`:
  - Use brown/tan color palette for toilets
  - Differentiate accessible toilets (darker brown)
  - Support highlighting and seasonal opacity
- [x] T020 [US1] Create toilet marker helper functions in `src/features/markers/markers.ts`:
  - `createToiletMarker(element, isNearest)` using generic factory
  - `addToiletMarkers(toilets, layer, options)` similar to existing `addMarkers()`
- [x] T021 [US1] Add toilet layer to `src/index.ts`:
  - Create `toiletLayer = L.featureGroup()` (parallel to waterLayer)
  - Add to Leaflet layer control: `{ "Public Toilets": toiletLayer }`
  - Set toilet layer hidden by default (not added to map initially)
  - Wire up `overlayadd` event listener to fetch toilets when enabled
  - Wire up `overlayremove` event listener to clear toilets when disabled
- [x] T022 [US1] Implement toilet fetching in `src/features/data/fetch.ts`:
  - Add `fetchToilets(bounds): Promise<Result<Element[], FetchError>>` function
  - Load `public_toilets.overpassql` template
  - Use existing `fetchFromOverpass()` infrastructure
- [x] T023 [US1] Test end-to-end: Load map → enable toilets → verify markers appear with brown styling
- [x] T024 [US1] Test map pan/zoom with toilets enabled → verify markers update correctly
- [x] T025 [US1] Verify no regression: Water taps still work independently

**Checkpoint**: User Story 1 complete - Users can display public toilets on the map as distinct markers

---

## Phase 4: User Story 2 - View Toilet Details and Accessibility Information (Priority: P1)

**Goal**: Users can click toilet markers to see detailed information including accessibility features, opening hours, and fees.

**Independent Test**: Click any toilet marker and verify popup displays with accessibility info (wheelchair, changing table), hours, and fee status.

### Tests for User Story 2 (TDD Approach)

- [ ] T026 [P] [US2] Unit test for `getToiletPopupContent()` in `tests/unit/features/markers/popup.test.ts`
- [ ] T027 [P] [US2] Test popup handles missing data gracefully (unknown wheelchair, no hours, etc.)
- [ ] T028 [US2] Integration test for toilet marker click → popup display in `tests/integration/toilet-popup.test.ts`

### Implementation for User Story 2

- [x] T029 [US2] Add `getToiletPopupContent()` to `src/features/markers/popup.ts`:
  - Display location/name from tags
  - Show wheelchair accessibility status with icon/text
  - Show changing table availability
  - Display fee status (free/paid/unknown)
  - Display opening hours or "24/7" if null
  - Show unisex/gendered status if available
  - Handle missing data gracefully ("Information not available")
  - Include navigation button (reuse existing `getNavigationButton()`)
- [x] T030 [US2] Wire up popup in `createToiletMarker()` in `src/features/markers/markers.ts`:
  - Call `getToiletPopupContent(element)` for toilet facilities
  - Bind popup to marker using `.bindPopup()`
  - Follow same pattern as water tap popups
- [x] T031 [US2] Test toilet popup content displays correctly for various scenarios:
  - Fully-specified toilet (all data present)
  - Minimal data toilet (only coordinates + amenity tag)
  - Accessible toilet with changing table
  - Paid toilet with specific hours
- [x] T032 [US2] Test navigation button in toilet popup works correctly

**Checkpoint**: User Story 2 complete - Users can view detailed toilet information including accessibility features

---

## Phase 5: User Story 3 - Filter Accessible Toilets (Priority: P2)

**Goal**: Users can filter the map to show only wheelchair-accessible toilets using a checkbox or filter control.

**Independent Test**: Enable accessibility filter → only wheelchair-accessible toilets remain visible → disable filter → all toilets visible again.

### Tests for User Story 3 (TDD Approach)

- [ ] T033 [P] [US3] Unit test for `isAccessible()` predicate function in `tests/unit/features/data/transformers.test.ts`
- [ ] T034 [US3] Integration test for accessibility filter toggle in `tests/integration/toilet-filter.test.ts`

### Implementation for User Story 3

- [ ] T035 [US3] Add `isAccessible(facility)` predicate to `src/features/data/transformers.ts`:
  - Return `true` only if `wheelchair === 'yes'`
  - Return `false` for 'no', 'limited', 'unknown'
- [ ] T036 [US3] Add accessibility filter state to `src/index.ts`:
  - Create `let accessibilityFilterActive = false` state variable
  - Add checkbox control to map UI: "Show only accessible toilets"
  - Wire up checkbox change event
- [ ] T037 [US3] Implement filter logic in toilet rendering:
  - When filter active: filter toilets by `isAccessible()` before adding markers
  - When filter inactive: show all toilets
  - Re-render markers when filter toggled
- [ ] T038 [US3] Handle empty results when no accessible toilets in area:
  - Show notification: "No accessible toilets found in this area"
  - Suggest zooming out or moving map
- [ ] T039 [US3] Test accessibility filter with various scenarios:
  - Area with mix of accessible and non-accessible toilets
  - Area with only non-accessible toilets (empty result)
  - Area with only accessible toilets (all visible)
  - Toggle filter on/off multiple times
- [ ] T040 [US3] Verify filter persists when panning/zooming map

**Checkpoint**: User Story 3 complete - Users can filter to show only wheelchair-accessible toilets

---

## Phase 6: User Story 4 - Navigate to Nearest Toilet (Priority: P2)

**Goal**: Users can get directions to the nearest toilet from their current location.

**Independent Test**: Click navigation button on a toilet marker → verify directions/route appears from current location.

### Tests for User Story 4 (TDD Approach)

- [ ] T041 [P] [US4] Unit test for `findNearestToilet()` in `tests/unit/features/data/transformers.test.ts`
- [ ] T042 [US4] Integration test for toilet navigation flow in `tests/integration/toilet-navigation.test.ts`

### Implementation for User Story 4

- [ ] T043 [US4] Add `findNearestToilet(toilets, userLocation)` to `src/features/data/transformers.ts`:
  - Calculate distances from user location to each toilet
  - Return nearest toilet with distance and estimated walking time
  - Handle empty toilet array gracefully
- [ ] T044 [US4] Enhance toilet popup navigation button:
  - Show distance from current location
  - Show estimated walking time
  - Reuse existing `openNavigation()` functionality from `src/features/navigation/navigation.ts`
- [ ] T045 [US4] Add "Find Nearest Toilet" button to map UI (optional enhancement):
  - Calculate nearest toilet on click
  - Highlight nearest toilet marker
  - Auto-open popup with navigation
- [ ] T046 [US4] Test navigation with location permission granted
- [ ] T047 [US4] Test navigation without location permission (fallback to manual selection)
- [ ] T048 [US4] Verify navigation works for both accessible and standard toilets

**Checkpoint**: User Story 4 complete - Users can navigate to toilets from their current location

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories, final validation

- [ ] T049 [P] Add legend to map UI showing facility type colors (water=blue, toilets=brown)
- [ ] T050 [P] Performance optimization: Test with 100+ combined markers (water + toilets)
- [ ] T051 [P] Add error handling for Overpass API rate limiting
- [ ] T052 Add loading indicators for toilet data fetching
- [ ] T053 [P] Update documentation in `README.md` with toilet search feature
- [ ] T054 [P] Update `.github/copilot-instructions.md` with implementation patterns (already done in PHASE1)
- [ ] T055 Code cleanup: Remove any dead code or unused imports
- [ ] T056 Security: Sanitize any user inputs in popup content
- [ ] T057 Run full test suite: `npm test` - ensure all tests pass
- [ ] T058 Run linter: `npm run lint` - ensure no warnings
- [ ] T059 Follow quickstart.md validation scenarios end-to-end
- [ ] T060 Constitution compliance check: Verify ADTs, strict typing, no regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately ✅ COMPLETE
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
  - **This is the refactoring phase - MUST complete before any toilet features**
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion
  - First toilet feature - provides basic display
- **User Story 2 (Phase 4)**: Depends on User Story 1 completion
  - Enhances markers with detailed popups
- **User Story 3 (Phase 5)**: Depends on User Story 1 completion (independent of US2)
  - Adds filtering capability
- **User Story 4 (Phase 6)**: Depends on User Story 1 completion (independent of US2/US3)
  - Adds navigation capability
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: BLOCKING - All other toilet features depend on this
  - Provides core toilet marker display infrastructure
- **User Story 2 (P1)**: Can start immediately after US1 - independent of US3/US4
- **User Story 3 (P2)**: Can start immediately after US1 - independent of US2/US4
- **User Story 4 (P2)**: Can start immediately after US1 - independent of US2/US3

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD approach)
- Types/models before transformers
- Transformers before styling
- Styling before marker creation
- Marker creation before integration
- Integration before validation

### Parallel Opportunities

**Phase 2 (Foundational):**
- T004, T005, T006 (tests) can run in parallel
- T007 (types) can run parallel with T008 (styling extraction)
- After T008: T009, T010 can run in parallel

**Phase 3 (User Story 1):**
- T013, T014, T015 (tests) can run in parallel
- T017 (overpass query) and T019 (styling) can run in parallel
- After US1 complete: US2, US3, US4 can ALL start in parallel (if team capacity allows)

**Phase 5-7:**
- US3 and US4 are completely independent - can work in parallel
- Polish tasks marked [P] can run in parallel

### Suggested MVP Scope

**Minimum Viable Product = Phase 2 + Phase 3 (User Story 1)**
- Refactored generic infrastructure
- Basic toilet display with distinct markers
- Toggle visibility via checkbox
- Default hidden, shows on enable
- Updates on pan/zoom

This delivers the core value: users can find public toilets on the map.

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (after foundational phase):
Task T013: "Unit test for elementToToiletFacility() transformer"
Task T014: "Unit test for getToiletMarkerStyle()"
Task T015: "Unit test for toilet tag parsing"

# Then implementation tasks with some parallelism:
Task T017: "Create public_toilets.overpassql"
# (parallel with T019 after T018)
Task T018: "Create transformers.ts"
Task T019: "Add getToiletMarkerStyle() to styling.ts"
# (after T017, T018, T019 complete)
Task T020: "Create toilet marker helpers"
# (continue sequentially for integration)
```

---

## Implementation Strategy

### TDD Approach (Per PHASE1-COMPLETE.md)
1. Write tests first for each user story
2. Watch tests fail
3. Implement functionality
4. Watch tests pass
5. Refactor if needed
6. Validate with integration tests

### Incremental Delivery
1. **Week 1**: Phase 2 (Refactoring) - Foundation with no regressions
2. **Week 2**: Phase 3 (US1) - MVP: Display public toilets
3. **Week 3**: Phase 4 (US2) + Phase 5 (US3) - Details and filtering (parallel)
4. **Week 4**: Phase 6 (US4) + Phase 7 (Polish) - Navigation and polish

### Quality Gates
- After each phase: Run `npm test` and `npm run lint`
- After each user story: Validate independent test criteria
- Before Phase 7: All user stories must be independently functional
- Before completion: Constitution compliance check

---

## Total Task Count

- **Phase 1 (Setup)**: 3 tasks ✅
- **Phase 2 (Foundational)**: 9 tasks (3 tests + 6 implementation)
- **Phase 3 (User Story 1)**: 13 tasks (4 tests + 9 implementation)
- **Phase 4 (User Story 2)**: 7 tasks (3 tests + 4 implementation)
- **Phase 5 (User Story 3)**: 8 tasks (2 tests + 6 implementation)
- **Phase 6 (User Story 4)**: 8 tasks (2 tests + 6 implementation)
- **Phase 7 (Polish)**: 12 tasks

**Total**: 60 tasks across 7 phases

**Parallel Opportunities**: 18 tasks marked [P] can run in parallel within their phases

**Test Coverage**: 14 test tasks (23% of total) - follows TDD approach
