# Quickstart: Umami Analytics Events

**Feature**: 005-umami-metrics  
**Date**: 2025-12-02

## Overview

This guide explains how to integrate the analytics module into the application and track user interactions.

## Prerequisites

- Umami script already loaded in `index.html` (already done)
- TypeScript strict mode enabled (already configured)
- Vitest for testing (already configured)

## Installation

No external dependencies required. The analytics module is self-contained.

## Module Structure

```
src/analytics/
├── index.ts      # Public API exports (only import from here)
├── types.ts      # Event type definitions
├── tracker.ts    # Core tracking logic with Umami integration
└── events.ts     # Event factory functions
```

## Usage

### Import from the Public API

```typescript
// ✅ CORRECT: Import from index
import { trackMapLoaded, trackMarkerClicked } from '../analytics';

// ❌ WRONG: Don't import from internal files
import { safeTrack } from '../analytics/tracker'; // Don't do this!
```

### Track Map Loaded (P1)

```typescript
import { trackMapLoaded } from '../analytics';

// When map initializes with user location
trackMapLoaded('user');

// When map falls back to default location (Riga)
trackMapLoaded('default');
```

### Track Marker Clicks (P1)

```typescript
import { trackMarkerClicked } from '../analytics';

// When user clicks a water marker
marker.on('click', () => {
  trackMarkerClicked('water');
});

// When user clicks a toilet marker
marker.on('click', () => {
  trackMarkerClicked('toilet');
});
```

### Track Navigation (P1)

```typescript
import { trackNavigationStarted } from '../analytics';

// When user clicks Navigate button in popup
navigateButton.onclick = () => {
  trackNavigationStarted('water'); // or 'toilet'
  openNavigation(lat, lon);
};
```

### Track Layer Toggle (P2)

```typescript
import { trackLayerEnabled, trackLayerDisabled } from '../analytics';

map.on('overlayadd', (e) => {
  if (e.name === 'Public Toilets') {
    const activeCount = getActiveLayerCount(); // implement based on your state
    trackLayerEnabled('Public Toilets', activeCount);
  }
});

map.on('overlayremove', (e) => {
  if (e.name === 'Public Toilets') {
    const activeCount = getActiveLayerCount();
    trackLayerDisabled('Public Toilets', activeCount);
  }
});
```

### Track Location (P2)

```typescript
import { 
  trackLocateRequested, 
  trackLocateSuccess, 
  trackLocateFailed 
} from '../analytics';

// When user clicks locate button
locateButton.onclick = () => {
  trackLocateRequested();
  
  navigator.geolocation.getCurrentPosition(
    () => {
      trackLocateSuccess();
    },
    (error) => {
      // Map error to reason category
      const reason = mapErrorToReason(error); // 'permission_denied' | 'timeout' etc.
      trackLocateFailed(reason);
    }
  );
};
```

### Track Area Exploration (P3)

```typescript
import { trackAreaExplored, trackEmptyArea } from '../analytics';

// After fetching facilities for new area
async function loadFacilities(bounds: LatLngBounds) {
  const result = await fetchFacilitiesInBounds(bounds);
  
  // trackAreaExplored is debounced internally - safe to call frequently
  trackAreaExplored();
  
  if (result.length === 0) {
    trackEmptyArea('water'); // or 'toilet'
  }
}
```

### Check Analytics Status

```typescript
import { isAnalyticsEnabled } from '../analytics';

// Check if analytics is working (for debugging)
if (isAnalyticsEnabled()) {
  console.log('Analytics is enabled');
} else {
  console.log('Analytics is disabled (DNT, blocked, or not loaded)');
}
```

## Key Principles

### 1. Fire and Forget

All tracking functions return `void` and never throw. They are designed to:
- Execute instantly without blocking
- Fail silently if Umami is unavailable
- Not affect application flow

```typescript
// Safe to call anywhere - never throws, never blocks
trackMarkerClicked('water');
```

### 2. No PII

Never include personal information in events:

```typescript
// ❌ WRONG: Don't include coordinates or user data
trackMapLoaded('user', { lat: 56.9496, lon: 24.1052 });

// ✅ CORRECT: Only include category/type information
trackMapLoaded('user');
```

### 3. Type Safety

The module uses strict types - TypeScript will catch invalid values:

```typescript
// ❌ TypeScript error: Argument is not assignable
trackMarkerClicked('fountain'); 

// ✅ Valid
trackMarkerClicked('water');
```

### 4. High Cohesion, Low Coupling

The analytics module:
- Has NO dependencies on app modules
- Accepts only simple primitives (strings, numbers)
- Never imports Leaflet, Element, or other app types

## Testing

### Mocking Analytics

For unit tests, mock the entire analytics module:

```typescript
import { vi } from 'vitest';

vi.mock('../analytics', () => ({
  trackMapLoaded: vi.fn(),
  trackMarkerClicked: vi.fn(),
  // ... other functions
  isAnalyticsEnabled: vi.fn(() => true),
}));
```

### Testing Analytics Module

The analytics module itself has unit tests:

```bash
npm test -- --grep "analytics"
```

## Viewing Events

Events appear in your Umami dashboard at https://cloud.umami.is under:
- **Events** tab: See all event types and counts
- **Properties** tab: Drill into event data (facility_type, layer_name, etc.)

## Troubleshooting

### Events not appearing

1. Check if analytics is enabled: `console.log(isAnalyticsEnabled())`
2. Check browser console for Umami script loading
3. Verify website ID in index.html matches your Umami dashboard
4. Wait a few minutes - Umami has a slight delay

### Ad blockers

Many ad blockers block analytics scripts. Events will simply not be sent in this case - this is expected and the app continues to work normally.

### Do Not Track

If the user has DNT enabled (`navigator.doNotTrack === '1'`), no events are sent. This is intentional and respects user privacy.
