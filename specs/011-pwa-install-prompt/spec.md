# Feature Specification: Mobile Install Prompt

**Feature Branch**: `011-pwa-install-prompt`
**Created**: 2026-09-07
**Status**: Draft
**Input**: User description: "Add a mobile 'install this app' prompt using @khmyznikov/pwa-install"

## Goal

Nudge returning mobile visitors to install Gribudzert to their home screen, without nagging first-time visitors or anyone already using the installed app.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prompt a Returning Mobile Visitor (Priority: P1)

As a mobile visitor who has used the map before, I want a gentle reminder that this can be installed as an app, so I can add it to my home screen for quicker access.

**Acceptance Scenarios**:

1. **Given** a mobile visitor opens the app for the first time, **When** the map finishes loading, **Then** no install dialog appears (their visit is only counted).
2. **Given** the same mobile visitor returns for a second visit, **When** the map has been up for about 3 seconds, **Then** the install dialog appears (Chrome's native flow, or Apple's "Add to Home Screen" instructions on iOS/iPadOS).
3. **Given** a desktop visitor (no coarse pointer, wide viewport), **When** they visit any number of times, **Then** the install dialog never appears.

### User Story 2 - Respect Dismissals and Installs (Priority: P1)

As a visitor who dismissed the prompt, I don't want to be asked again right away. As a visitor who installed the app, I don't want to be asked ever again.

**Acceptance Scenarios**:

1. **Given** a visitor dismissed the dialog, **When** they return within 14 days, **Then** the dialog does not appear again.
2. **Given** a visitor dismissed the dialog more than 14 days ago, **When** they return and are otherwise eligible, **Then** the dialog may appear again.
3. **Given** a visitor already has the app installed (running in standalone display mode) or has completed the install flow, **When** they visit, **Then** the dialog never appears.

### Edge Cases

- App already running standalone (`display-mode: standalone` or iOS `navigator.standalone`): skip entirely, no visit is counted.
- `localStorage` unavailable or throwing (private browsing, quota): every read/write is guarded; the feature degrades to "never shows" rather than throwing.
- Component's own auto-show heuristics are disabled (`manual-apple`, `manual-chrome`); only our own visit/cooldown logic calls `showDialog()`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST NOT show the prompt while the app is running in standalone/installed mode.
- **FR-002**: System MUST NOT show the prompt on non-mobile devices (no coarse pointer and viewport wider than 768px).
- **FR-003**: System MUST count visits per browser and only show the prompt from the second qualifying visit onward.
- **FR-004**: System MUST wait roughly 3 seconds after boot before showing the dialog, so it never competes with initial map load.
- **FR-005**: System MUST record a dismiss timestamp when the visitor closes the dialog without installing, and MUST NOT show it again for 14 days from that timestamp.
- **FR-006**: System MUST record a successful install and never show the prompt again afterward.
- **FR-007**: System MUST fire analytics events for shown, accepted, and dismissed outcomes (see `src/analytics/events.ts`), following the existing fire-and-forget, never-throw convention.
- **FR-008**: All `localStorage` access MUST be wrapped so a storage failure never breaks app boot.

## Assumptions

- "Mobile" is approximated by `(pointer: coarse)` or a ≤768px viewport; there is no user-agent sniffing.
- Visit counting, dismiss cooldown, and the installed flag live in `localStorage` under the `gribudzert:install-prompt` key prefix, scoped per browser (not per account — there is no account).
