# Tasks: Umami Analytics Events

**Input**: Design documents from `/specs/005-umami-metrics/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/analytics.ts ✅, quickstart.md ✅

**Tests**: Unit tests are included per plan.md specification ("Testing: vitest (unit tests for analytics module)")

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Analytics module: `src/analytics/`
- Tests: `tests/unit/analytics/`

---

## Phase 1: Setup (Analytics Module Foundation)

**Purpose**: Create the analytics module structure and core infrastructure

- [ ] T001 Create analytics module directory structure at src/analytics/
- [ ] T002 [P] Create Umami type declarations in src/analytics/types.ts (UmamiTracker, UmamiTrackFunction, UmamiEventData from contracts/analytics.ts)
- [ ] T003 [P] Create event type definitions in src/analytics/types.ts (AnalyticsEvent discriminated union with all event kinds from data-model.md)
- [ ] T004 Implement core tracker with safeTrack, isUmamiAvailable, and respectsDoNotTrack in src/analytics/tracker.ts (per research.md patterns)
- [ ] T005 Implement debounce utility in src/analytics/tracker.ts (trailing-edge, 2000ms for area_explored per research.md)

---

## Phase 2: Foundational (Shared Analytics Infrastructure)

**Purpose**: Core analytics functionality that ALL user stories depend on

**⚠️ CRITICAL**: No user story tracking can work until this phase is complete

- [ ] T006 Create isAnalyticsEnabled function in src/analytics/tracker.ts (checks Umami availability + DNT)
- [ ] T007 Create public API exports in src/analytics/index.ts (export only from this file per quickstart.md)
- [ ] T008 [P] Create unit test file for tracker in tests/unit/analytics/tracker.test.ts (test isUmamiAvailable, respectsDoNotTrack, safeTrack silent failure)

**Checkpoint**: Analytics module core ready - event tracking can now be implemented

---

## Phase 3: User Story 1 - View Map Engagement Metrics (Priority: P1) 🎯 MVP

**Goal**: Track core user interactions: map load, marker clicks, navigation button clicks

**Independent Test**: Load app, click markers, click Navigate button → verify events in Umami dashboard

### Tests for User Story 1

- [ ] T009 [P] [US1] Unit test for trackMapLoaded in tests/unit/analytics/events.test.ts
- [ ] T010 [P] [US1] Unit test for trackMarkerClicked in tests/unit/analytics/events.test.ts
- [ ] T011 [P] [US1] Unit test for trackNavigationStarted in tests/unit/analytics/events.test.ts

### Implementation for User Story 1

- [ ] T012 [P] [US1] Implement trackMapLoaded function in src/analytics/events.ts (accepts LocationType: 'user' | 'default')
- [ ] T013 [P] [US1] Implement trackMarkerClicked function in src/analytics/events.ts (accepts FacilityType: 'water' | 'toilet')
- [ ] T014 [P] [US1] Implement trackNavigationStarted function in src/analytics/events.ts (accepts FacilityType: 'water' | 'toilet')
- [ ] T015 [US1] Export trackMapLoaded, trackMarkerClicked, trackNavigationStarted from src/analytics/index.ts
- [ ] T016 [US1] Integrate trackMapLoaded call in src/core/map.ts (after successful map initialization)
- [ ] T017 [US1] Integrate trackMarkerClicked call in src/features/markers/markers.ts (on marker click event)
- [ ] T018 [US1] Integrate trackNavigationStarted call in src/features/markers/popup.ts (on Navigate button click)

**Checkpoint**: Map engagement tracking complete - verify in Umami dashboard

---

## Phase 4: User Story 2 - Understand Layer Usage Patterns (Priority: P2)

**Goal**: Track when users enable/disable facility layers and count active layers

**Independent Test**: Toggle Public Toilets layer on/off → verify layer_enabled/layer_disabled events in Umami

### Tests for User Story 2

- [ ] T019 [P] [US2] Unit test for trackLayerEnabled in tests/unit/analytics/events.test.ts
- [ ] T020 [P] [US2] Unit test for trackLayerDisabled in tests/unit/analytics/events.test.ts

### Implementation for User Story 2

- [ ] T021 [P] [US2] Implement trackLayerEnabled function in src/analytics/events.ts (accepts LayerName and activeLayerCount)
- [ ] T022 [P] [US2] Implement trackLayerDisabled function in src/analytics/events.ts (accepts LayerName and activeLayerCount)
- [ ] T023 [US2] Export trackLayerEnabled, trackLayerDisabled from src/analytics/index.ts
- [ ] T024 [US2] Integrate layer tracking in src/core/map.ts (on overlayadd and overlayremove events)

**Checkpoint**: Layer usage tracking complete - verify toggling layers shows events in Umami

---

## Phase 5: User Story 3 - Monitor Location Feature Usage (Priority: P2)

**Goal**: Track locate button clicks and success/failure outcomes

**Independent Test**: Click Locate Me button → verify locate_requested, then locate_success or locate_failed events

### Tests for User Story 3

- [ ] T025 [P] [US3] Unit test for trackLocateRequested in tests/unit/analytics/events.test.ts
- [ ] T026 [P] [US3] Unit test for trackLocateSuccess in tests/unit/analytics/events.test.ts
- [ ] T027 [P] [US3] Unit test for trackLocateFailed in tests/unit/analytics/events.test.ts

### Implementation for User Story 3

- [ ] T028 [P] [US3] Implement trackLocateRequested function in src/analytics/events.ts
- [ ] T029 [P] [US3] Implement trackLocateSuccess function in src/analytics/events.ts
- [ ] T030 [P] [US3] Implement trackLocateFailed function in src/analytics/events.ts (accepts LocationFailureReason)
- [ ] T031 [US3] Export trackLocateRequested, trackLocateSuccess, trackLocateFailed from src/analytics/index.ts
- [ ] T032 [US3] Integrate location tracking in src/features/location/geolocation.ts (on button click, success, and error callbacks)

**Checkpoint**: Location tracking complete - verify locate button interactions show in Umami

---

## Phase 6: User Story 4 - Track Search Area Behavior (Priority: P3)

**Goal**: Track map exploration and empty area discoveries

**Independent Test**: Pan/zoom to new area → verify area_explored event; pan to empty area → verify empty_area event

### Tests for User Story 4

- [ ] T033 [P] [US4] Unit test for trackAreaExplored (including debounce behavior) in tests/unit/analytics/events.test.ts
- [ ] T034 [P] [US4] Unit test for trackEmptyArea in tests/unit/analytics/events.test.ts

### Implementation for User Story 4

- [ ] T035 [P] [US4] Implement trackAreaExplored function in src/analytics/events.ts (uses debounced safeTrack, 2000ms)
- [ ] T036 [P] [US4] Implement trackEmptyArea function in src/analytics/events.ts (accepts FacilityType)
- [ ] T037 [US4] Export trackAreaExplored, trackEmptyArea from src/analytics/index.ts
- [ ] T038 [US4] Integrate area exploration tracking in src/features/data/fetch.ts (after data loads for new area)
- [ ] T039 [US4] Integrate empty area tracking in src/features/data/fetch.ts (when no facilities found)

**Checkpoint**: Area exploration tracking complete - verify panning triggers debounced events

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, validation, and final quality checks

- [ ] T040 Verify all analytics functions fail silently when Umami unavailable (edge case from spec.md)
- [ ] T041 Verify Do Not Track preference is respected across all tracking functions
- [ ] T042 Run all tests (npm test) and ensure 100% pass rate
- [ ] T043 Run lint (npm run lint) and fix any issues
- [ ] T044 Run quickstart.md validation scenarios manually
- [ ] T045 Verify 10 distinct event types in Umami dashboard (per SC-001)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (different event types, different files)
  - Or sequentially in priority order (P1 → P2 → P2 → P3)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational - No dependencies on other stories
- **User Story 4 (P3)**: Can start after Foundational - No dependencies on other stories

### Within Each User Story

- Tests written first (T009-T011, T019-T020, T025-T027, T033-T034)
- Event functions in src/analytics/events.ts (can run in parallel within story)
- Export from index.ts
- Integration into existing app files

### Parallel Opportunities

Setup phase:
- T002 (Umami types) and T003 (event types) can run in parallel

Foundational phase:
- T008 (tracker tests) can run parallel with other foundational work

User Story 1:
- T009, T010, T011 (tests) can run in parallel
- T012, T013, T014 (event functions) can run in parallel

User Story 2:
- T019, T020 (tests) can run in parallel
- T021, T022 (event functions) can run in parallel

User Story 3:
- T025, T026, T027 (tests) can run in parallel
- T028, T029, T030 (event functions) can run in parallel

User Story 4:
- T033, T034 (tests) can run in parallel
- T035, T036 (event functions) can run in parallel

Cross-story parallelism:
- Once Foundational is complete, all 4 user stories can be worked on simultaneously

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task T009: "Unit test for trackMapLoaded"
Task T010: "Unit test for trackMarkerClicked"
Task T011: "Unit test for trackNavigationStarted"

# Launch all event functions together:
Task T012: "Implement trackMapLoaded"
Task T013: "Implement trackMarkerClicked"
Task T014: "Implement trackNavigationStarted"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T008)
3. Complete Phase 3: User Story 1 (T009-T018)
4. **STOP and VALIDATE**: Test map engagement tracking in Umami dashboard
5. Deploy if ready - core value delivered

### Incremental Delivery

1. Complete Setup + Foundational → Analytics infrastructure ready
2. Add User Story 1 (P1) → Map engagement tracking → Deploy (MVP!)
3. Add User Story 2 (P2) → Layer usage tracking → Deploy
4. Add User Story 3 (P2) → Location tracking → Deploy
5. Add User Story 4 (P3) → Area exploration tracking → Deploy
6. Each story adds insight without breaking previous tracking

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (map engagement)
   - Developer B: User Story 2 (layer tracking)
   - Developer C: User Story 3 (location tracking)
   - Developer D: User Story 4 (area exploration)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable via Umami dashboard
- Analytics module has ZERO dependencies on app modules (one-way dependency only)
- All tracking functions are fire-and-forget (void return, never throw)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
