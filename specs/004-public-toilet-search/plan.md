# Implementation Plan: Public and Accessible Toilet Search

**Feature**: 004-public-toilet-search  
**Status**: Phase 4 Complete (User Stories 1 & 2 Implemented)  
**Created**: 2025-10-12
**Last Updated**: 2025-10-15

## Technical Context

### Current System Analysis

**Existing Architecture**:
- Water tap system uses Overpass API for fetching POI data based on map bounds
- Marker system supports different visual styles (color, radius, crossed-out for non-drinkable)
- Layer-based architecture with `L.FeatureGroup` for managing markers
- Dynamic refetching on map pan/zoom via `setupMapNavigationHandlers`
- Location detection with fallback to Riga center
- Result-based error handling with `Result<T, E>` ADT
- Popup system for displaying point details with navigation integration

**Key Files**:
- `src/features/data/fetch.ts` - Data fetching logic (reusable)
- `src/features/markers/markers.ts` - Marker creation (needs refactoring)
- `src/oql/drinking_water.overpassql` - Overpass query template
- `src/index.ts` - Application initialization and orchestration
- `src/types/domain.ts` - Domain types and branded types

### Technologies

- TypeScript 5.9.2 / ES2020
- Leaflet 1.9.4 (mapping library)
- Vite 7.1.9 (bundler)
- Overpass API for OSM data queries

### Dependencies

- Existing location detection (feature 003)
- Existing marker and popup infrastructure
- Existing map navigation handlers
- Existing error handling and notification system

### Technical Challenges & Solutions

**Challenge 1: Code Duplication Between Water and Toilet Logic**
- **Problem**: Current marker creation is tightly coupled to water-specific logic (`isDrinkable`, water source types)
- **Solution**: Extract generic marker creation, introduce facility type discriminator
- **Rationale**: DRY principle, easier maintenance, clearer separation of concerns

**Challenge 2: Multiple Overpass Queries vs Single Combined Query**
- **Problem**: Separate queries for water and toilets could hit rate limits and slow performance
- **Solution**: Create combined Overpass query when both layers enabled; support independent queries when only one layer active
- **Rationale**: Optimize for common case (both enabled) while supporting flexibility

**Challenge 3: Distinguishing Marker Types Visually**
- **Problem**: Need clear visual distinction between water taps and toilets
- **Solution**: Use different color palette (blue tones for water, brown/tan for toilets) and optional icon shapes
- **Rationale**: Color is fastest visual discriminator; follows common conventions (blue=water, brown=earth/toilets)

### Constitution Compliance Check (Initial)

#### 1. Code Quality & Maintainability
- ✅ **Status**: COMPLIANT - Will refactor coupled logic into composable functions
- **Evidence**: Extracting marker creation logic, using discriminated unions for facility types
- **Action Items**: Refactor markers.ts to separate water-specific and generic logic

#### 2. Strict Typing
- ✅ **Status**: COMPLIANT - Using discriminated unions and branded types
- **Evidence**: Will use `FacilityType = 'water' | 'toilet'` discriminator, existing Result<T,E> patterns
- **Action Items**: Define toilet-specific types, ensure exhaustive pattern matching

#### 3. Algebraic Data Types (ADTs)
- ✅ **Status**: COMPLIANT - Leveraging sum types for facility discrimination
- **Evidence**: Will model facilities as discriminated union with `kind` field
- **Action Items**: Create `Facility` ADT with water/toilet variants

#### 4. User Experience Consistency
- ✅ **Status**: COMPLIANT - Following existing patterns
- **Evidence**: Reusing layer control, popup, notification, and loading patterns
- **Action Items**: Ensure toilet markers hidden by default, consistent error messages

#### 5. Testing & Quality Assurance
- ⚠️ **Status**: NEEDS ATTENTION - No tests exist for new toilet functionality yet
- **Evidence**: Need integration tests for toilet fetching, marker creation, filtering
- **Action Items**: Add tests in Phase 2, follow existing test patterns in tests/

---

## Phase 0: Research & Technical Discovery

### Research Questions

1. **What is the standard OpenStreetMap tagging scheme for public toilets?**
2. **How should accessibility data be structured and validated?**
3. **What is the best approach for refactoring marker creation to be facility-agnostic?**
4. **Should filters be implemented as layer controls or separate UI components?**

---

## Phase 1: Design & Data Model

### Completed Artifacts

- [x] `research.md` - Technical research findings
- [x] `data-model.md` - Entity definitions and relationships
- [x] `contracts/` - API contracts and types
- [x] `quickstart.md` - Implementation guide
- [ ] Update `.github/copilot-instructions.md` with new patterns

### Key Design Decisions

(To be filled after research phase)

---

## Phase 2: Implementation Tasks

**Prerequisites**: Phase 0 and 1 complete, all research questions answered

### Task Breakdown

(To be generated after design phase)

---

## Gates

### Gate 1: Constitution Compliance (Pre-Implementation)
- [ ] All code changes follow constitution principles
- [ ] ADTs used for facility type discrimination
- [ ] Strict typing maintained throughout
- [ ] No regression in existing water tap functionality

### Gate 2: Requirements Coverage
- [ ] All FR-001 through FR-013 addressed in design
- [ ] All user stories have corresponding implementation
- [ ] Edge cases documented and handled

### Gate 3: Quality Assurance
- [ ] Unit tests for new toilet logic
- [ ] Integration tests for toilet layer interaction
- [ ] No TypeScript errors or warnings
- [ ] Biome linting passes

---

## Risk Register

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| Tight coupling in markers.ts makes refactoring difficult | High | Careful extraction, comprehensive tests | Open |
| Overpass API rate limiting with multiple queries | Medium | Combined query strategy | Open |
| Incomplete toilet data in OSM | Medium | Graceful handling of missing fields | Open |
| Performance degradation with many markers | Medium | Marker clustering (future), query optimization | Open |

---

## Notes

- This feature should NOT introduce new dependencies
- Existing water tap functionality must remain unchanged and working
- Focus on code cleanup and generalization as requested by user
- Default state: toilets hidden, water taps visible

