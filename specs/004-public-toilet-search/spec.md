# Feature Specification: Public and Accessible Toilet Search

**Feature Branch**: `feature/004-public-toilet-search`  
**Created**: 2025-10-12  
**Status**: Draft  
**Input**: User description: "Similarly as with water taps, make a search for public and accessible toilets"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Display Public Toilets on Map (Priority: P1)

When a user views the map, they can choose to display public toilets by enabling a checkbox control. Once enabled, public toilets in the visible area are displayed as distinct markers alongside existing water tap markers, allowing users to quickly identify nearby toilet facilities.

**Why this priority**: Core functionality that provides immediate value - users can locate public toilets in their area, which is a common urgent need when traveling or exploring new areas. Default-off behavior prevents map clutter and gives users control.

**Independent Test**: Can be fully tested by loading the map (verifying toilets are hidden by default), enabling the toilet checkbox, and verifying public toilet markers appear in the visible area, distinct from water tap markers. Delivers standalone value as a basic toilet locator.

**Acceptance Scenarios**:

1. **Given** user has the map loaded, **When** the map displays initially, **Then** public toilet markers are NOT displayed (hidden by default)
2. **Given** toilet markers are hidden, **When** user enables the toilet checkbox, **Then** public toilet markers appear in the visible map area
3. **Given** public toilets are enabled and exist in the area, **When** markers are displayed, **Then** toilet markers are visually distinct from water tap markers (different color or icon)
4. **Given** multiple types of facilities exist, **When** viewing the map with toilets enabled, **Then** users can easily distinguish between water taps and toilets at a glance
5. **Given** toilets are displayed, **When** user pans or zooms the map, **Then** toilet markers update to show facilities in the new visible area
6. **Given** toilets are displayed, **When** user disables the toilet checkbox, **Then** all toilet markers are hidden from the map

---

### User Story 2 - View Toilet Details and Accessibility Information (Priority: P1)

When a user clicks on a toilet marker, they see detailed information including accessibility features (wheelchair access, baby changing facilities, etc.), opening hours, and fees if applicable.

**Why this priority**: Essential for user decision-making - accessibility information is critical for users with disabilities, parents with children, and anyone needing specific facilities.

**Independent Test**: Can be tested by clicking any toilet marker and verifying the popup displays relevant details including accessibility information. Works independently once markers are displayed.

**Acceptance Scenarios**:

1. **Given** user clicks a toilet marker, **When** marker is selected, **Then** popup displays with toilet details (location, accessibility features, hours)
2. **Given** toilet has accessibility features, **When** popup opens, **Then** wheelchair access status is clearly indicated
3. **Given** toilet has baby changing facilities, **When** popup opens, **Then** changing table availability is displayed
4. **Given** toilet requires payment, **When** popup opens, **Then** fee information is shown
5. **Given** toilet has operating hours, **When** popup opens, **Then** hours or 24/7 status is displayed
6. **Given** toilet details are unavailable, **When** popup opens, **Then** system shows "Information not available" for missing fields

---

### User Story 3 - Filter Accessible Toilets (Priority: P2)

Users can filter the map to show only wheelchair-accessible toilets, helping users with mobility needs quickly find suitable facilities.

**Why this priority**: Significantly improves accessibility and usability for users with specific needs, though the basic feature works without filtering.

**Independent Test**: Can be tested by toggling the accessibility filter and verifying only wheelchair-accessible toilets remain visible. Enhances the basic toilet display feature.

**Acceptance Scenarios**:

1. **Given** user activates accessibility filter, **When** filter is applied, **Then** only wheelchair-accessible toilets are displayed
2. **Given** accessibility filter is active, **When** no accessible toilets exist in area, **Then** system shows message "No accessible toilets found in this area"
3. **Given** user deactivates accessibility filter, **When** filter is removed, **Then** all public toilets are displayed again
4. **Given** filter is active, **When** user pans to new area, **Then** only accessible toilets in new area are shown

---

### User Story 4 - Navigate to Nearest Toilet (Priority: P2)

Users can get directions to the nearest toilet from their current location, helping them reach facilities quickly when needed urgently.

**Why this priority**: Adds convenience for users who need immediate access to facilities, building on the existing navigation functionality for water taps.

**Independent Test**: Can be tested by clicking navigation option on a toilet marker and verifying directions/route appears. Leverages existing navigation infrastructure.

**Acceptance Scenarios**:

1. **Given** user has location permission granted, **When** user selects "Navigate" on a toilet marker, **Then** system provides directions from current location
2. **Given** navigation is requested, **When** directions are shown, **Then** estimated distance and walking time are displayed
3. **Given** user is viewing multiple toilets, **When** user wants quickest access, **Then** system can highlight or sort by nearest toilet first

---

### Edge Cases

- What happens when no public toilets exist in the visible area?
  - System should display message "No public toilets found in this area" and suggest zooming out
- What happens when toilet data lacks accessibility information?
  - Show "Accessibility information unavailable" instead of making assumptions
- What happens when user is in a rural area with very few toilets?
  - Display available toilets even if far away, with distance indicators
- What happens when toilet opening hours are complex (seasonal, special schedules)?
  - Display full schedule information or link to source data
- What happens when fetching toilet data fails?
  - Show error message with retry option, maintain display of previously loaded toilets if available
- What happens with unisex vs. gendered toilets?
  - Display toilet type information when available in the data

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST fetch public toilet data based on visible map bounds from available geographic data sources
- **FR-002**: System MUST display toilet markers on the map distinct from water tap markers (different visual style)
- **FR-003**: System MUST show toilet details in a popup when marker is clicked, including: name/location, accessibility status, fees (if any), operating hours
- **FR-004**: System MUST indicate wheelchair accessibility status clearly for each toilet facility
- **FR-005**: System MUST indicate baby changing facility availability when data is available
- **FR-006**: System MUST update toilet markers when user pans or zooms the map to show facilities in new visible area
- **FR-007**: System MUST provide a filter option to show only wheelchair-accessible toilets
- **FR-008**: System MUST handle cases where no toilets exist in visible area with informative messaging
- **FR-009**: System MUST handle missing or incomplete toilet data gracefully without breaking the display
- **FR-010**: System MUST maintain map performance when displaying both water taps and toilets simultaneously
- **FR-011**: System MUST query for public and publicly accessible toilet facilities
- **FR-012**: System MUST display appropriate loading indicators when fetching toilet data
- **FR-013**: System MUST hide toilet markers by default when the map is loaded, showing them only when the user enables the toilet display option

### Key Entities

- **Public Toilet**: Geographic coordinates, name/description, accessibility features (wheelchair access, changing table), fee status (free/paid), opening hours, unisex/gendered status
- **Accessibility Status**: Boolean wheelchair access flag, changing table availability, additional accessibility features
- **Toilet Marker**: Visual representation on map (color, icon, size), distinct styling from water tap markers, click interaction for details popup
- **Filter State**: Current filter settings (show all vs. accessible only), applied to both display and data fetching

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Public toilet markers appear on the map within 2 seconds of the map loading or viewport change (90% of cases)
- **SC-002**: Users can distinguish between water tap and toilet markers without confusion (validated through visual design contrast)
- **SC-003**: Users with disabilities can identify wheelchair-accessible toilets within 5 seconds using the filter
- **SC-004**: System displays toilet information accurately for 95% of available public toilet entries in tested areas
- **SC-005**: Map remains responsive (pan/zoom actions under 100ms delay) when displaying up to 100 combined markers (water taps + toilets)
- **SC-006**: Accessibility filter correctly shows only wheelchair-accessible toilets 100% of the time
- **SC-007**: System gracefully handles missing data fields without breaking the popup display in all tested scenarios
- **SC-008**: Toilet markers are hidden by default on initial map load, and only shown when the user enables the toilet display option

## Assumptions *(mandatory)*

- Geographic data sources contain sufficient public toilet data for major urban areas globally
- Public toilet data uses standard categorization for accessibility features (wheelchair access, changing facilities)
- Users understand standard map symbols and color coding for different facility types
- Existing map infrastructure can handle additional toilet data queries without significant modification
- Users have sufficient screen space to display multiple marker types clearly (minimum 320px width)
- Toilet operating hours follow recognizable time formats when present
- Fee information is available in the data source when applicable

## Out of Scope *(mandatory)*

- Real-time toilet availability status (occupied/vacant)
- User reviews or ratings of toilet facilities
- Toilet cleanliness ratings or reports
- Photos of toilet facilities
- Indoor navigation within buildings to locate toilets
- Reporting broken or closed toilets
- Private toilets (only public and publicly accessible toilets)
- Non-toilet facilities (showers, lockers, etc.)
- Mobile app notifications for nearby toilets
- Offline map support for toilet locations
- Multi-language translations of toilet amenity descriptions
- Integration with third-party toilet finder databases beyond primary data source

## Dependencies

- Geographic data source availability and data quality
- Existing map infrastructure (marker system, popup functionality)
- Existing location detection functionality from feature 003
- Location services for navigation/distance calculations
- Existing data fetching and error handling infrastructure

## Risks & Mitigation

**Risk**: Geographic data for toilets may be incomplete or outdated in some areas
- **Mitigation**: Display data age/freshness when available, provide link to data source for users to contribute updates

**Risk**: Too many markers may clutter the map and affect performance
- **Mitigation**: Implement marker clustering for dense areas, limit queries to visible bounds, optimize marker rendering

**Risk**: Accessibility data may be inconsistent or missing across regions
- **Mitigation**: Clearly label when accessibility information is unavailable rather than making assumptions

**Risk**: Users may confuse toilet markers with water tap markers
- **Mitigation**: Use significantly different visual styles (color and icon shape), add legend to map interface

**Risk**: Data source rate limiting may affect toilet data fetching
- **Mitigation**: Combine toilet and water tap queries into single request when possible, implement request caching

## Notes

- This feature follows the same architectural pattern as the existing water tap search functionality
- Toilet markers should use a distinct color palette to avoid confusion with water tap markers (suggested: brown/tan tones vs. blue tones for water)
- Consider adding a legend or filter panel to toggle visibility of water taps vs. toilets independently in future iterations
- Accessibility information is critical for this feature - prioritize clear display even when data is limited
