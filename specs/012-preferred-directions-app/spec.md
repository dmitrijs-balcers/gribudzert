# Feature Specification: Preferred Directions App

**Feature Branch**: `012-preferred-directions-app`
**Created**: 2026-09-11
**Status**: Draft
**Input**: User description: "Suggest OsmAnd instead of the default maps app on iOS, remember the choice"

## Goal

Let an iPhone or iPad visitor get walking directions in OsmAnd instead of Apple Maps, and remember that choice, without ever asking them up front.

## Background

Safari gives a web app no way to know whether OsmAnd is installed. So the app cannot "detect and switch". Instead it offers OsmAnd as a one-tap alternative, and uses OsmAnd's universal link (`https://osmand.net/map/navigate?end=LAT,LON&profile=pedestrian`), which opens the OsmAnd app when it is installed and the OsmAnd web planner when it is not. A custom scheme such as `osmandmaps://` would show a Safari error when the app is missing, so it is not used.

Android already shows the system app chooser for `geo:` links, so OsmAnd appears there without any in-app choice. Desktop browsers cannot open native apps at all.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Try OsmAnd from a point's sheet (Priority: P1)

As an iPhone visitor who uses OsmAnd, I want a small "Open in OsmAnd instead" link under the Directions button, so I can get there in the app I already use.

**Acceptance Scenarios**:

1. **Given** an iPhone visitor opens a point's sheet, **When** the sheet renders, **Then** the Directions button opens Apple Maps and a secondary link reads "Open in OsmAnd instead".
2. **Given** that visitor taps "Open in OsmAnd instead", **When** the link opens, **Then** OsmAnd (or its web planner) receives a pedestrian route to the point.

### User Story 2 - Remember the choice (Priority: P1)

As a visitor who tapped OsmAnd once, I want the Directions button to open OsmAnd from then on, with a way back to Apple Maps.

**Acceptance Scenarios**:

1. **Given** the visitor tapped "Open in OsmAnd instead", **When** they open any other sheet, **Then** the Directions button opens OsmAnd and the secondary link reads "Open in Apple Maps instead".
2. **Given** the visitor returns on a later visit in the same browser, **When** they open a sheet, **Then** OsmAnd is still the Directions button.
3. **Given** the visitor taps "Open in Apple Maps instead", **When** they open the next sheet, **Then** Apple Maps is the Directions button again.

### User Story 3 - No noise where it is not needed (Priority: P2)

As an Android or desktop visitor, I do not want an extra link that does nothing useful for me.

**Acceptance Scenarios**:

1. **Given** an Android visitor, **When** a sheet renders, **Then** only the `geo:` Directions button appears (the system chooser already lists OsmAnd).
2. **Given** a desktop visitor, **When** a sheet renders, **Then** only the Google Maps Directions button appears.

### Edge Cases

- A stored preference the platform cannot honour (for example `osmand` read on Android) is ignored and the platform default is used.
- An unknown stored value is treated as "no preference".
- `localStorage` throwing on read or write never breaks the sheet; the choice still applies for the current visit.
- The sheet re-renders its directions links from app state, so a choice made in one sheet shows in that sheet at once and in every sheet opened afterwards.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On Apple devices the system MUST offer both Apple Maps and OsmAnd, with Apple Maps as the default.
- **FR-002**: The OsmAnd link MUST be the `osmand.net/map/navigate` universal link with `profile=pedestrian`, never a custom URL scheme.
- **FR-003**: Tapping the alternative link MUST open that app and store it as the preferred app for this browser.
- **FR-004**: The preferred app MUST become the main Directions button in every sheet opened afterwards, and the former default MUST become the alternative.
- **FR-005**: On Android and the web the system MUST NOT show an alternative link.
- **FR-006**: The `navigation_started` analytics event MUST carry a `maps_app` property naming the app the link opens.
- **FR-007**: All `localStorage` access MUST be guarded so a storage failure never throws.

## Assumptions

- Layering: which apps a platform offers and how a preference resolves is pure domain code (`src/domain/directions-app.ts`); link building, storage and the stateful chooser are feature adapters (`src/features/directions/`); the preference is part of the guidance app state (`src/app/guidance/`) and the links are rendered by the detail sheet (`src/ui/detail-sheet/`).
- The preference is one value under the `gribudzert:directions-app` key in `localStorage`, scoped per browser.
- Platform detection stays user-agent based, as it was for the existing Directions button.
