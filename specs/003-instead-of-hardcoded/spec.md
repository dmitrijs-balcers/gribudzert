# Feature Specification: Location-Based Map Initialization

**Feature Branch**: `003-instead-of-hardcoded`  
**Created**: 2025-10-10  
**Status**: Draft  
**Input**: User description: "Instead of hardcoded riga coords, user should see nearest water point based on its location and visible map"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Location Detection on First Visit (Priority: P1)

When a user opens the application for the first time, the system automatically detects their location and centers the map on their position, then loads water points visible in that area.

**Why this priority**: This is the core value proposition - users get immediate access to water points near them without manual searching. This transforms the app from a Riga-specific tool to a location-aware utility.

**Independent Test**: Can be fully tested by opening the app in a new browser/location and verifying the map centers on user location (with permission) and displays nearby water points. Delivers immediate value as a standalone feature.

**Acceptance Scenarios**:

1. **Given** user opens the application for the first time, **When** the page loads, **Then** system requests location permission
2. **Given** user grants location permission, **When** location is obtained, **Then** map centers on user's current position
3. **Given** map is centered on user location, **When** map view is established, **Then** water points within the visible map area are loaded and displayed
4. **Given** user's location is obtained, **When** water points are loaded, **Then** the nearest water point to user is highlighted or indicated

---

### User Story 2 - Fallback to Default Location (Priority: P1)

When location permission is denied or unavailable, the system falls back to a default location (Riga) so users can still use the application.

**Why this priority**: Essential for usability - users must be able to access the app even without location services. Without this, denying permission would break the app.

**Independent Test**: Can be tested by denying location permission and verifying the app still loads with Riga as center. Ensures app remains functional in all scenarios.

**Acceptance Scenarios**:

1. **Given** user denies location permission, **When** permission is denied, **Then** map centers on default location (Riga)
2. **Given** location services are unavailable (HTTP context), **When** page loads, **Then** system shows informative message and uses default location
3. **Given** location request times out, **When** timeout occurs, **Then** system falls back to default location with notification
4. **Given** fallback location is used, **When** map loads, **Then** water points in the default area are displayed

---

### User Story 3 - Manual Location Search (Priority: P2)

Users can manually pan and zoom the map to explore different areas, and water points update to show what's currently visible on the map.

**Why this priority**: Provides flexibility for users who want to explore areas other than their current location (planning trips, checking new neighborhoods).

**Independent Test**: Can be tested by panning/zooming the map and verifying water points update for the new visible area. Works independently once map is initialized.

**Acceptance Scenarios**:

1. **Given** map is loaded, **When** user pans to a new area, **Then** water points for the new visible area are loaded
2. **Given** user is viewing a location, **When** user zooms in or out significantly, **Then** water points are refreshed for the new zoom level/area
3. **Given** user manually navigates map, **When** area changes, **Then** nearest water point to map center is indicated

---

### User Story 4 - Re-center on Current Location (Priority: P3)

Users can tap the locate button to re-center the map on their current location at any time, useful if they've panned away or are moving.

**Why this priority**: Convenience feature for users who have navigated away and want to return to their current position quickly.

**Independent Test**: Can be tested by panning away from user location, clicking locate button, and verifying map re-centers. Enhances existing locate functionality.

**Acceptance Scenarios**:

1. **Given** user has panned away from their location, **When** user clicks locate button, **Then** map re-centers on current location
2. **Given** user has moved to a new location, **When** user clicks locate button, **Then** map updates to show new location and nearby water points
3. **Given** map re-centers on user location, **When** location is obtained, **Then** nearest water point is indicated

---

### Edge Cases

- What happens when user is in an area with no water points (e.g., rural area, ocean)?
  - System should display message "No water points found in this area" and allow user to zoom out or pan
- What happens when location services are slow to respond?
  - Show loading indicator for up to 10 seconds, then fall back to default location
- What happens when user moves while the app is open?
  - Locate button allows manual refresh; automatic updates not required for MVP
- What happens on very slow network connections?
  - Show loading state; implement reasonable timeout (30 seconds) before showing error
- What happens when Overpass API returns errors for user's location?
  - Fall back to cached data if available, or show error message with retry option

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect user's geographic location on initial page load using browser geolocation API
- **FR-002**: System MUST request user permission before accessing location data, with clear explanation of why location is needed
- **FR-003**: System MUST center the map on user's detected location when permission is granted
- **FR-004**: System MUST fall back to default location (Riga) when location permission is denied, unavailable, or times out
- **FR-005**: System MUST fetch water points based on the currently visible map bounds (viewport), not hardcoded coordinates
- **FR-006**: System MUST identify and indicate the nearest water point to the user's location (or map center)
- **FR-007**: System MUST update water points when user manually pans or zooms the map to a significantly different area
- **FR-008**: System MUST display appropriate loading indicators during location detection and water point fetching
- **FR-009**: System MUST show user-friendly error messages for location permission denial, timeout, or unavailability
- **FR-010**: System MUST maintain existing locate button functionality to re-center on current location at any time
- **FR-011**: System MUST handle cases where no water points exist in the visible area with informative messaging
- **FR-012**: System MUST work in both secure (HTTPS) and localhost contexts for location services

### Key Entities

- **User Location**: Geographic coordinates (latitude, longitude) obtained from browser, accuracy radius, timestamp of last location update
- **Map Viewport**: Current visible bounds of the map (north, south, east, west coordinates), center point, zoom level
- **Water Point**: Geographic coordinates, distance from user location, attributes (color, accessibility, seasonal status), nearest-to-user flag
- **Location Permission State**: Granted, denied, unavailable, pending - determines app behavior

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users with location services enabled see a map centered on their location within 3 seconds of page load (90% of cases)
- **SC-002**: Users can identify the nearest water point to their current location within 5 seconds of the map loading
- **SC-003**: When users pan the map more than 50% of viewport distance, water points refresh within 2 seconds
- **SC-004**: System handles location permission denial gracefully 100% of the time without breaking functionality
- **SC-005**: Users can successfully use the app in areas outside Riga, Latvia (tested in at least 3 different cities globally)
- **SC-006**: 95% of users understand why location permission is being requested before granting/denying
- **SC-007**: App remains functional for users who deny location permission, with no error states preventing usage

