# Implementation Plan: Umami Analytics Events

**Branch**: `005-umami-metrics` | **Date**: 2025-12-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-umami-metrics/spec.md`

## Summary

Add a self-contained analytics module to track user interactions with the map application. The module will use Umami's JavaScript tracking API (`window.umami.track()`) to capture events for map engagement, layer toggling, location features, and area exploration. The design follows high cohesion/low coupling principles - the analytics module is completely independent and can be disabled or swapped without affecting core app functionality.

## Technical Context

**Language/Version**: TypeScript 5.9.2 / ES2020  
**Primary Dependencies**: Umami Cloud (already included via script tag in index.html)  
**Storage**: N/A (events sent to Umami Cloud)  
**Testing**: vitest (unit tests for analytics module)  
**Target Platform**: Web browser (modern evergreen browsers)
**Project Type**: Single (web application)  
**Performance Goals**: Zero blocking - all analytics calls must be fire-and-forget  
**Constraints**: <1ms overhead per event, fail silently when Umami unavailable  
**Scale/Scope**: ~10 event types, moderate traffic

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| 1. Code Quality & Maintainability | ✅ PASS | Separate module, single responsibility, explicit behavior |
| 2. Strict Typing | ✅ PASS | Discriminated unions for events, branded types where needed |
| 3. Algebraic Data Types | ✅ PASS | Event types as discriminated unions with `kind` field |
| 4. User Experience Consistency | ✅ PASS | Non-blocking, invisible to user |
| 5. Testing & Quality Assurance | ✅ PASS | Unit tests for all analytics functions |
| 6. Error Handling | ✅ PASS | Silent failures, no exceptions propagated to app |
| 7. Performance & Scalability | ✅ PASS | Fire-and-forget, debouncing for high-frequency events |
| 8. Security & Privacy | ✅ PASS | No PII, no precise coordinates, respects DNT |

## Project Structure

### Documentation (this feature)

```text
specs/005-umami-metrics/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── analytics.ts     # Event type definitions and API contracts
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── analytics/           # NEW: Self-contained analytics module
│   ├── index.ts         # Public API exports
│   ├── types.ts         # Event type definitions (discriminated unions)
│   ├── tracker.ts       # Core tracking logic with Umami integration
│   └── events.ts        # Event factory functions (type-safe event creators)
├── core/
├── features/
│   ├── markers/
│   │   ├── popup.ts     # MODIFY: Add navigation tracking call
│   │   └── markers.ts   # MODIFY: Add marker click tracking
│   ├── location/
│   │   └── geolocation.ts  # MODIFY: Add location tracking calls
│   └── data/
│       └── fetch.ts     # MODIFY: Add area exploration tracking
├── types/
├── ui/
└── utils/

tests/
├── unit/
│   └── analytics/       # NEW: Analytics module tests
│       ├── tracker.test.ts
│       └── events.test.ts
└── integration/
```

**Structure Decision**: Analytics is a new self-contained module under `src/analytics/` following high cohesion principles. It exposes a minimal public API and has no dependencies on other application modules.

## Complexity Tracking

> No violations - design follows all constitution principles.
