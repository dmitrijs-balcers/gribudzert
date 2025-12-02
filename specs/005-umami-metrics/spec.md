# Feature Specification: Umami Analytics Events

**Feature Branch**: `005-umami-metrics`  
**Created**: 2025-12-02  
**Status**: Draft  
**Input**: User description: "I want to add umami metrics to better understand how my app is being used"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Map Engagement Metrics (Priority: P1)

As a product owner, I want to see how users interact with the map so that I can understand which features are most valuable and identify areas for improvement.

**Why this priority**: Understanding user engagement is the core value proposition of analytics. Without this data, there's no visibility into how the app is actually being used.

**Independent Test**: Can be verified by viewing the Umami dashboard after users interact with the app, showing event counts and patterns for core interactions.

**Acceptance Scenarios**:

1. **Given** a user loads the app, **When** the map initializes successfully, **Then** a "map_loaded" event is tracked with the initial location type (user location vs. default Riga)
2. **Given** a user is viewing the map, **When** they click on a water point marker, **Then** a "marker_clicked" event is tracked with the facility type (water)
3. **Given** a user is viewing the map, **When** they click on a toilet marker, **Then** a "marker_clicked" event is tracked with the facility type (toilet)
4. **Given** a user views a popup, **When** they click the "Navigate" button, **Then** a "navigation_started" event is tracked

---

### User Story 2 - Understand Layer Usage Patterns (Priority: P2)

As a product owner, I want to know which facility layers users enable so that I can prioritize feature development and data quality for the most-used layers.

**Why this priority**: Layer usage directly informs which facility types are most valuable to users, helping prioritize future development efforts.

**Independent Test**: Can be verified by toggling layers on/off and checking Umami dashboard for corresponding events.

**Acceptance Scenarios**:

1. **Given** a user is viewing the map, **When** they enable the "Public Toilets" layer, **Then** a "layer_enabled" event is tracked with the layer name
2. **Given** a user has the "Public Toilets" layer enabled, **When** they disable it, **Then** a "layer_disabled" event is tracked with the layer name
3. **Given** any layer state change, **When** the event is tracked, **Then** the event includes the total number of active layers

---

### User Story 3 - Monitor Location Feature Usage (Priority: P2)

As a product owner, I want to understand how users interact with location features so that I can optimize the location detection flow and improve user experience.

**Why this priority**: Location is a key feature that affects user experience. Understanding success/failure rates helps identify issues.

**Independent Test**: Can be verified by using the locate button and checking Umami for corresponding events.

**Acceptance Scenarios**:

1. **Given** a user is viewing the map, **When** they click the "Locate Me" button, **Then** a "locate_requested" event is tracked
2. **Given** a user clicked "Locate Me", **When** location detection succeeds, **Then** a "locate_success" event is tracked
3. **Given** a user clicked "Locate Me", **When** location detection fails, **Then** a "locate_failed" event is tracked with the failure reason category

---

### User Story 4 - Track Search Area Behavior (Priority: P3)

As a product owner, I want to understand how users explore the map so that I can optimize data loading and identify popular areas.

**Why this priority**: Understanding geographic exploration patterns helps optimize caching and data loading strategies.

**Independent Test**: Can be verified by panning/zooming the map and checking for area-related events.

**Acceptance Scenarios**:

1. **Given** a user is viewing the map, **When** they pan or zoom to a new area, **Then** after data loads, a "area_explored" event is tracked
2. **Given** data is being loaded for an area, **When** no facilities are found, **Then** an "empty_area" event is tracked with the facility type

---

### Edge Cases

- What happens when Umami script fails to load? Events should fail silently without affecting app functionality.
- What happens when user has ad-blocker blocking Umami? Events should fail silently.
- How are rapid successive events handled (e.g., fast panning)? Events should be debounced to avoid flooding analytics.
- What happens in offline mode? Events should be skipped gracefully.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST track custom events using Umami's event tracking API
- **FR-002**: System MUST NOT block or delay user interactions while tracking events
- **FR-003**: System MUST fail silently if Umami is unavailable (blocked, offline, script error)
- **FR-004**: System MUST debounce high-frequency events (map panning) to prevent excessive event volume
- **FR-005**: System MUST include relevant metadata with each event (facility type, layer name, location type)
- **FR-006**: System MUST NOT include personally identifiable information (PII) in event data
- **FR-007**: System MUST NOT include precise user coordinates in event data (privacy protection)
- **FR-008**: System MUST respect user privacy preferences (Do Not Track header if applicable)

### Key Entities

- **AnalyticsEvent**: Represents a trackable user action with event name and optional metadata properties
- **EventCategory**: Classification of events (engagement, navigation, discovery, error)

## Assumptions

- Umami cloud service is already configured and the script is included in `index.html`
- The existing website ID (`9aad9379-5532-44f3-be3b-f0096b298962`) is correct and active
- Umami's `window.umami.track()` API is available when the script loads successfully
- Event data will be used for product improvement, not for user tracking or advertising

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Product owner can view at least 5 distinct event types in Umami dashboard within 24 hours of deployment
- **SC-002**: 100% of defined user interactions are tracked when Umami is available
- **SC-003**: Zero impact on app performance - no user-visible delays from analytics code
- **SC-004**: Zero JavaScript errors caused by analytics code, even when Umami is blocked/unavailable
- **SC-005**: Analytics events provide actionable insights (e.g., most clicked facility type, locate success rate)
