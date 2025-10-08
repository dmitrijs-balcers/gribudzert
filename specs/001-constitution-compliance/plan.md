# Implementation Plan: Constitution Compliance Refactoring

**Branch**: `001-constitution-compliance` | **Date**: 2024 | **Status**: Planning
**Input**: Analysis from `/IMPROVEMENT_ANALYSIS.md`

## Summary

Refactor the Gribudzert TypeScript map application to align with constitution principles focusing on strict typing, algebraic data types, code quality, and user experience consistency. The project currently has working functionality but lacks proper type safety, modular structure, error handling with ADTs, and comprehensive testing.

## Technical Context

**Language/Version**: TypeScript 5.9.2, targeting ESNext  
**Primary Dependencies**: Leaflet 1.9.4 (map library), Vite 7.1.4 (build tool)  
**Storage**: N/A (fetches data from Overpass API at runtime)  
**Testing**: NEEDS SETUP (will use Vitest + Testing Library)  
**Target Platform**: Web browsers (desktop + mobile, progressive web app)  
**Project Type**: Single-page web application  
**Performance Goals**: <3s initial load, <100ms UI interactions, offline-capable  
**Constraints**: Must maintain backward compatibility with existing map functionality  
**Scale/Scope**: ~300 LOC currently, targeting ~800-1000 LOC after refactoring with tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Violations & Required Actions

| Principle | Current Status | Required Action |
|-----------|---------------|-----------------|
| **Code Quality** | ❌ Single 299-line file, broken functions | Split into modules, fix missing functions |
| **Strict Typing** | ⚠️ Uses `any`, missing return types | Eliminate `any`, add explicit types everywhere |
| **ADTs** | ❌ No Result/Option types | Implement ADTs for all error-prone operations |
| **UX Consistency** | ⚠️ Uses `alert()`, no loading states | Toast notifications, proper loading/error states |
| **Testing** | ❌ No tests | Add Vitest, achieve 80%+ coverage on business logic |
| **Error Handling** | ❌ Broken async code, untyped errors | Use Result types, fix fetchWater function |
| **Security** | ⚠️ No CSP, missing SRI | Add security headers, validate external resources |

### Gates

- ✅ **TypeScript Strict Mode**: Already enabled in tsconfig.json
- ❌ **No `any` Types**: Currently has `L.FeatureGroup<any>`
- ❌ **Explicit Return Types**: Missing on most functions
- ❌ **Error Handling via ADTs**: Not implemented
- ❌ **Test Coverage**: No tests exist
- ⚠️ **Accessibility**: Partial (has ARIA labels, needs audit)

## Project Structure

### Documentation (this feature)

```
specs/001-constitution-compliance/
├── plan.md              # This file
├── research.md          # Phase 0: Technical spike findings
├── data-model.md        # Phase 1: Type definitions and ADTs
├── quickstart.md        # Phase 1: Development guide
├── contracts/           # Phase 1: API contracts and type exports
│   ├── result-type.md
│   ├── domain-types.md
│   └── error-types.md
└── tasks.md             # Phase 2: Detailed implementation tasks
```

### Source Code (repository root)

**Current Structure:**
```
src/
├── index.ts             # 299 lines - everything
├── types/
│   ├── overpass.ts      # API response types
│   ├── overpassql.d.ts  # Module declaration
│   └── xml.d.ts         # Module declaration
└── oql/
    └── drinking_water.overpassql  # Query file
```

**Target Structure:**
```
src/
├── index.ts                    # Entry point (~50 lines - initialization only)
├── types/
│   ├── result.ts               # NEW: Result<T, E> and Option<T> ADTs
│   ├── domain.ts               # NEW: Branded types (NodeId, Latitude, etc.)
│   ├── errors.ts               # NEW: Error discriminated unions
│   ├── platform.ts             # NEW: Platform detection types
│   ├── overpass.ts             # EXISTING: API response types (improved)
│   ├── overpassql.d.ts         # EXISTING: Module declaration
│   └── xml.d.ts                # EXISTING: Module declaration
├── core/
│   ├── config.ts               # NEW: Application configuration constants
│   ├── map.ts                  # NEW: Map initialization and setup
│   └── state.ts                # NEW: Application state management (if needed)
├── features/
│   ├── markers/
│   │   ├── markers.ts          # NEW: Marker creation and management
│   │   └── popup.ts            # NEW: Popup content and interaction
│   ├── location/
│   │   └── geolocation.ts      # NEW: User location feature
│   ├── navigation/
│   │   └── navigation.ts       # NEW: Platform-aware navigation
│   └── data/
│       ├── fetch.ts            # NEW: Data fetching with Result types
│       └── parser.ts           # NEW: Data parsing (parseOsmDoc, etc.)
├── ui/
│   ├── notifications.ts        # NEW: Toast/notification system
│   └── loading.ts              # NEW: Loading state indicators
└── utils/
    ├── dom.ts                  # NEW: DOM utilities and type guards
    ├── html.ts                 # NEW: HTML escaping and sanitization
    └── logger.ts               # NEW: Logging utilities

tests/
├── unit/
│   ├── utils/
│   │   ├── html.test.ts
│   │   └── dom.test.ts
│   ├── types/
│   │   └── result.test.ts
│   └── features/
│       └── navigation.test.ts
├── integration/
│   ├── map-init.test.ts
│   └── data-fetch.test.ts
└── setup.ts                    # Test configuration
```

**Structure Decision**: Single project structure with clear separation of concerns. Using feature-based organization for main functionality (markers, location, navigation, data) with shared core, types, UI, and utils. This maintains simplicity while improving modularity.

## Complexity Tracking

*No violations requiring justification - the refactoring reduces complexity.*

## Implementation Phases

### Phase 0: Research & Spike (2-4 hours)

**Goal**: Validate approach and understand current behavior

**Tasks**:
1. Document current application behavior (map features, interactions)
2. Test current functionality manually (all user flows)
3. Research Leaflet TypeScript types for proper generic usage
4. Spike: Create Result type and test with one async operation
5. Spike: Test module extraction (extract one feature, verify it works)
6. Document any hidden dependencies or side effects

**Deliverables**:
- `research.md`: Findings, spikes results, risk assessment
- Decision: Proceed with full refactoring or adjust approach

### Phase 1: Design & Contracts (4-6 hours)

**Goal**: Define all types, interfaces, and module contracts before coding

**Tasks**:
1. Design complete ADT system:
   - Result<T, E> type with exhaustive pattern matching
   - Option<T> type for nullable values
   - All error discriminated unions
   - Platform type discriminated union
   - LocationState discriminated union

2. Define branded types for domain:
   - NodeId, Latitude, Longitude, ColorCode, etc.

3. Document module contracts:
   - Each module's exported functions with signatures
   - Data flow between modules
   - Error propagation strategy

4. Design notification system UI/UX
5. Plan test structure and coverage targets

**Deliverables**:
- `data-model.md`: All type definitions with examples
- `contracts/*.md`: Module interface contracts
- `quickstart.md`: Developer setup and architecture guide

### Phase 2: Critical Fixes (Week 1: 8-12 hours)

**Goal**: Fix broken code and establish type safety foundation

**Priority 1: Fix Broken Code**
- [ ] Implement missing `parseOsmDoc()` function
- [ ] Implement missing `loadPointsXml()` function  
- [ ] Fix `fetchWater()` function (currently has wrong types)
- [ ] Remove undefined `water` variable reference
- [ ] Clean up commented code

**Priority 2: Implement ADT Foundation**
- [ ] Create `src/types/result.ts` with Result and Option types
- [ ] Create `src/types/errors.ts` with all error discriminated unions
- [ ] Create `src/types/domain.ts` with branded types
- [ ] Create `src/types/platform.ts` with Platform discriminated union

**Priority 3: Type Safety**
- [ ] Add explicit return types to ALL functions
- [ ] Replace `L.FeatureGroup<any>` with proper type
- [ ] Remove all `as` type assertions, use type guards
- [ ] Create type guards in `src/utils/dom.ts`

**Priority 4: Error Handling**
- [ ] Refactor `fetchWater()` to return `Result<Element[], FetchError>`
- [ ] Update geolocation to use `Result<Coordinates, GeolocationError>`
- [ ] Create centralized error handler function

**Success Criteria**:
- ✅ TypeScript compiles with no errors
- ✅ Zero `any` types in codebase
- ✅ All functions have explicit return types
- ✅ No broken function references
- ✅ All async operations return Result types

### Phase 3: Modular Refactoring (Week 2: 12-16 hours)

**Goal**: Extract modules with proper separation of concerns

**Step 1: Extract Utilities** (safest to extract first)
- [ ] Create `src/utils/html.ts` (escapeHtml function)
- [ ] Create `src/utils/dom.ts` (type guards, DOM helpers)
- [ ] Create `src/utils/logger.ts` (replace console.log)
- [ ] Create `src/core/config.ts` (constants, color map, URLs)

**Step 2: Extract Features**
- [ ] Create `src/features/navigation/navigation.ts` (openNavigation + platform detection)
- [ ] Create `src/features/data/fetch.ts` (fetchWater with Result type)
- [ ] Create `src/features/data/parser.ts` (parseOsmDoc, loadPointsXml)
- [ ] Create `src/features/markers/markers.ts` (addNodesToLayer)
- [ ] Create `src/features/markers/popup.ts` (popup creation logic)
- [ ] Create `src/features/location/geolocation.ts` (locateMe function)

**Step 3: Extract Core**
- [ ] Create `src/core/map.ts` (map initialization, controls)
- [ ] Create `src/ui/notifications.ts` (replace alert() calls)
- [ ] Create `src/ui/loading.ts` (loading indicators)

**Step 4: Update Entry Point**
- [ ] Refactor `src/index.ts` to import and orchestrate modules
- [ ] Keep only initialization logic in index.ts
- [ ] Ensure proper error boundaries

**Success Criteria**:
- ✅ No file exceeds 150 lines
- ✅ Each module has single responsibility
- ✅ Clear dependency graph (no circular dependencies)
- ✅ Application works identically to before refactoring
- ✅ All imports are explicit and typed

### Phase 4: UI/UX Improvements (Week 2: 6-8 hours)

**Goal**: Replace alerts with proper UI, add loading states

**Tasks**:
- [ ] Implement toast notification system (replace all alert())
- [ ] Add loading spinner for data fetch operations
- [ ] Add loading state for geolocation
- [ ] Implement error boundaries for map initialization
- [ ] Add empty state handling (no points found)
- [ ] Add `prefers-reduced-motion` support
- [ ] Improve focus management in popups
- [ ] Test all keyboard navigation

**Success Criteria**:
- ✅ Zero `alert()` calls in codebase
- ✅ Loading states visible for all async operations
- ✅ Errors shown via toast notifications
- ✅ Full keyboard accessibility maintained
- ✅ Respects user motion preferences

### Phase 5: Testing Infrastructure (Week 3: 10-14 hours)

**Goal**: Set up testing and achieve 80%+ coverage on business logic

**Setup**:
- [ ] Install Vitest, @testing-library/dom
- [ ] Configure Vitest in vite.config.ts
- [ ] Create test setup file
- [ ] Add test scripts to package.json

**Unit Tests** (Priority: Pure functions first):
- [ ] `utils/html.test.ts` - escapeHtml function
- [ ] `utils/dom.test.ts` - type guard functions
- [ ] `types/result.test.ts` - Result/Option helper functions
- [ ] `features/navigation.test.ts` - platform detection logic
- [ ] `features/data/parser.test.ts` - parsing functions
- [ ] `core/config.test.ts` - configuration values

**Integration Tests**:
- [ ] Map initialization test
- [ ] Data fetch and render test
- [ ] Marker click and popup test
- [ ] Geolocation flow test (mocked)

**Success Criteria**:
- ✅ 80%+ coverage on business logic
- ✅ All pure functions tested
- ✅ Tests run in <5 seconds
- ✅ Tests are deterministic
- ✅ CI-ready (can run in GitHub Actions)

### Phase 6: Code Quality Tools (Week 3: 4-6 hours)

**Goal**: Add linting and formatting

**Tasks**:
- [ ] Install Biome (or ESLint + Prettier)
- [ ] Configure linter rules (strict TypeScript rules)
- [ ] Add lint scripts to package.json
- [ ] Fix all linting errors
- [ ] Format all files
- [ ] Add pre-commit hook (optional but recommended)

**Success Criteria**:
- ✅ Zero linting errors
- ✅ Consistent code formatting
- ✅ Lint passes in CI

### Phase 7: Security & Performance (Week 4: 6-8 hours)

**Goal**: Add security headers and performance optimizations

**Security**:
- [ ] Add CSP meta tag to index.html
- [ ] Add SRI hashes to external resources (Leaflet CSS, Umami)
- [ ] Bundle Leaflet CSS locally instead of CDN
- [ ] Audit and strengthen HTML sanitization
- [ ] Review third-party dependencies for vulnerabilities

**Performance**:
- [ ] Add resource hints (preconnect for API)
- [ ] Implement marker clustering for large datasets
- [ ] Lazy-load service worker registration
- [ ] Optimize bundle size (tree-shaking check)
- [ ] Add performance monitoring

**Success Criteria**:
- ✅ CSP implemented without breaking functionality
- ✅ All external resources have SRI
- ✅ Lighthouse score 90+ in all categories
- ✅ Bundle size <200KB gzipped

### Phase 8: Documentation & Polish (Week 4: 4-6 hours)

**Goal**: Update documentation and finalize

**Tasks**:
- [ ] Update README.md with new architecture
- [ ] Document all public APIs with JSDoc
- [ ] Create CONTRIBUTING.md
- [ ] Add architecture diagram
- [ ] Update constitution compliance checklist
- [ ] Create migration guide (for future contributors)

**Success Criteria**:
- ✅ All public functions have JSDoc
- ✅ README reflects current architecture
- ✅ Clear contribution guidelines

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing functionality | Medium | High | Extensive manual testing after each phase |
| Leaflet type issues | Low | Medium | Research types in Phase 0, have fallback approach |
| Timeline overrun | Medium | Low | Phases are independent; can deprioritize Phase 7-8 |
| Over-engineering with ADTs | Low | Medium | Keep ADTs simple, only use where clear benefit |
| Test complexity | Medium | Medium | Start with pure functions, add integration tests gradually |

## Success Metrics

**Type Safety** (Phase 2 completion):
- 0% `any` types (currently ~2 occurrences)
- 100% explicit return types (currently ~30%)
- 0 type assertions without guards (currently ~3)

**Code Quality** (Phase 3 completion):
- Max file size: 150 lines (currently 299 in index.ts)
- 0 circular dependencies
- 0 broken function references

**Test Coverage** (Phase 5 completion):
- 80%+ business logic coverage (currently 0%)
- 100% pure function coverage
- <5s test suite execution

**Performance** (Phase 7 completion):
- Lighthouse Performance: 90+
- Lighthouse Accessibility: 95+
- Lighthouse Best Practices: 95+
- Lighthouse SEO: 90+

**User Experience** (Phase 4 completion):
- 0 `alert()` calls (currently ~5)
- Loading states for all async ops
- Proper error messages for all error cases
- Full keyboard navigation maintained

## Dependencies & Prerequisites

**Required**:
- Node.js 18+ and Yarn
- TypeScript 5.9.2 (already installed)
- Vite 7.1.4 (already installed)
- Leaflet 1.9.4 (already installed)

**To Install**:
```bash
# Testing
yarn add -D vitest @vitest/ui @testing-library/dom happy-dom

# Linting
yarn add -D @biomejs/biome

# Type checking
yarn add -D @types/node
```

## Rollout Strategy

**Development Approach**: Feature branch with incremental commits

1. Create branch: `001-constitution-compliance`
2. Complete phases sequentially (each phase is a logical unit)
3. After Phase 2: Can deploy (broken code fixed, type-safe)
4. After Phase 3: Should deploy (modular, maintainable)
5. After Phase 5: Production-ready (tested, quality gates)
6. After Phase 7-8: Optimal (secure, performant, documented)

**Deployment Gates**:
- Phase 2: ✅ TypeScript compiles, manual testing passes
- Phase 3: ✅ All tests pass, functionality verified
- Phase 5: ✅ 80%+ coverage, CI passes
- Phase 7: ✅ Security audit passes, Lighthouse >90

## Timeline Summary

| Phase | Time Estimate | Deliverable |
|-------|---------------|-------------|
| Phase 0: Research | 2-4 hours | research.md, decision to proceed |
| Phase 1: Design | 4-6 hours | Type definitions, contracts |
| Phase 2: Critical Fixes | 8-12 hours | Type-safe, working codebase |
| Phase 3: Refactoring | 12-16 hours | Modular architecture |
| Phase 4: UX | 6-8 hours | Better error/loading states |
| Phase 5: Testing | 10-14 hours | 80%+ test coverage |
| Phase 6: Quality | 4-6 hours | Linted, formatted |
| Phase 7: Security/Perf | 6-8 hours | Secure, optimized |
| Phase 8: Docs | 4-6 hours | Complete documentation |
| **Total** | **56-80 hours** | Constitution-compliant app |

**Realistic Timeline**: 2-3 weeks of focused development

## Next Steps

1. ✅ Review this plan with stakeholders
2. ⏭️ Execute Phase 0: Research & Spike
3. ⏭️ Fill in `research.md` with findings
4. ⏭️ Proceed to Phase 1: Design (or adjust plan based on research)
5. ⏭️ Execute `/speckit.tasks` to generate detailed task breakdown
