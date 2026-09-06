# 009 — Live location for runners

## Why

Gribudzert is used by trail runners who open the app mid-run to find the nearest tap.
Today the app blocks map creation for up to 10 s on a single high-accuracy fix, drops the
position the moment it is drawn, and the "nearest" ranking never follows the runner. A runner
who moves 500 m is looking at a stale dot and a wrong nearest marker.

Target browsers are current versions only (Chrome, Safari, Firefox, mobile Safari/Chrome).
No fallbacks for missing Permissions API, Page Visibility, `:has()`, or CSS custom properties.

## Behaviour (user's point of view)

### Arriving

1. The map appears immediately: centred on the last remembered position when there is one
   (saved on this device, at most 7 days old), otherwise on Riga. No loading overlay for
   geolocation.
2. Location tracking starts right away, unless the browser reports the geolocation permission
   as `denied` (then nothing is requested and the locate button shows the blocked state).
3. When the first fix arrives the map re-centres on it with `setView` (no animation) at the
   current zoom, the user dot appears, facilities are ranked from the runner, and the map
   is in **follow** mode.
4. If tracking fails at startup and there was no remembered position, the existing info toast
   "Could not detect your location. Showing Riga area." is shown. If there was a remembered
   position, no toast: the map is already somewhere useful.

### While running

5. The user dot moves in place as fixes arrive (no flicker, no re-created marker). The
   accuracy circle follows and resizes; it is not drawn at all when accuracy is worse than
   500 m (an IP-derived fix would otherwise cover the whole map).
6. When the runner is moving (speed ≥ 0.5 m/s and the fix carries a heading) the dot shows a
   heading cone pointing the way they run. Standing still hides the cone.
7. In follow mode the map pans (animated `panTo`) to keep the dot centred on every fix. Any
   user-initiated pan (drag or keyboard arrows) leaves follow mode; zooming does not.
8. The nearest water point is re-ranked from the live position whenever the runner has moved
   at least 25 m since the last ranking. Re-ranking is skipped while a popup is open and
   performed as soon as it closes. Re-ranking only re-renders from the facility cache; it
   never triggers a network fetch by itself.
9. A **nearest HUD** pill sits bottom-centre: `🚰 Nearest water · 350 m ↗ NE`. The arrow is
   rotated to the true bearing from the runner to the point; the compass point is the
   8-wind name. Distance and bearing update on every fix (cheap recomputation, no re-render
   of markers). Tapping it flies to the nearest point and opens its popup. It is hidden when
   there is no user position, or the water layer is off, or no water point is loaded.
10. A thin dashed **beeline** connects the dot to the nearest water point. Hidden under the
    same conditions as the HUD.
11. When no fix has arrived for 30 s the dot turns grey (stale) and the pulse stops; the
    next fix restores it. When the tab is hidden, watching stops (battery); it resumes when
    the tab is visible again.

### The locate button

12. One button, top-right, keyboard operable, always with an accessible name. Its look
    reflects the tracking state:
    - `idle` / `failed`: outline crosshair. Click → start tracking and enter follow mode.
    - `acquiring`: crosshair with a pulsing ring, `aria-busy="true"`.
    - `tracking`, follow **off**: filled crosshair. Click → enter follow mode: `flyTo` the
      position at `max(currentZoom, 15)`.
    - `tracking`, follow **on**: filled crosshair on accent background, `aria-pressed="true"`.
      Click → leave follow mode (tracking continues).
    - `failed` with `permission-denied`: crosshair with a slash; `title` and `aria-label`
      "Location access is blocked. Allow it in your browser's site settings."
      Click → retries `start()` (the user may have re-enabled it) and, if it fails again,
      shows the error toast.
13. No success toast on locate. The map moving and the button state are the feedback.
    Error toasts are shown only for explicit button clicks, never for the silent startup
    attempt (startup uses rule 4 instead).
14. Icons are inline SVG (currentColor), never emoji, so they render identically everywhere.
    Button is ≥ 44×44 px. Respect `prefers-reduced-motion` for the pulse and any transitions.

### Facility markers (feature C, separate agent)

15. Shape encodes kind: water badges stay circular; toilet badges become rounded squares
    (`border-radius: 22%`). Colour is never the only channel.
16. Every badge gets a small pointer tail at the bottom so the exact coordinate is
    unambiguous on a trail; the icon anchor is the tip of the tail.
17. The nearest water marker shows a distance chip beneath it (`350 m` / `1.20 km`, from
    `formatDistance`), white pill, dark text, `pointer-events: none`, `aria-hidden`.
    The accessible label of the marker already says "nearest"; add the distance to it too.

## Architecture

Follow the constitution and the existing style: discriminated unions with `kind`,
`readonly` everywhere, branded units created through validating constructors, `Result`
for fallible operations, no `as` outside branded constructors, no code comments (names,
types and structure carry the meaning; JSDoc only where the existing file already has it).

### Domain — `src/domain/`

- `geo.ts`: add
  - `Heading` branded number, `heading(value): Heading | null` valid for `0 ≤ v < 360`.
  - `MetersPerSecond` branded, `metersPerSecond(value)` non-negative finite.
  - `bearingBetween(from: LatLon, to: LatLon): Heading` — initial great-circle bearing,
    normalised to `[0, 360)`.
  - `CompassPoint = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'` and
    `compassPointOf(heading: Heading): CompassPoint`.
- `position.ts` (new, exported from `domain/index.ts`):
  ```ts
  type UserPosition = {
    readonly lat: number; readonly lon: number;
    readonly accuracy: Meters;
    readonly heading: Heading | null;      // null when not moving or unknown
    readonly speed: MetersPerSecond | null;
    readonly at: Timestamp;
  };
  ```
  `isMoving(position)`, `toUserPosition(raw: GeolocationPosition): UserPosition` (heading kept
  only when finite and speed ≥ `MOVING_SPEED_THRESHOLD_MPS`). Move `UserPosition` out of
  `features/location/geolocation.ts`.

### Location feature — `src/features/location/`

- `tracker.ts` — the only place that talks to `navigator.geolocation`.
  ```ts
  type TrackingState =
    | { readonly kind: 'idle' }
    | { readonly kind: 'acquiring'; readonly lastKnown: UserPosition | null }
    | { readonly kind: 'tracking'; readonly position: UserPosition; readonly freshness: 'live' | 'stale' }
    | { readonly kind: 'paused'; readonly lastKnown: UserPosition | null }
    | { readonly kind: 'failed'; readonly error: LocationError; readonly lastKnown: UserPosition | null };

  type LocationTracker = {
    readonly state: () => TrackingState;
    readonly subscribe: (listener: (state: TrackingState) => void) => () => void;
    readonly start: () => void;   // idempotent while acquiring/tracking
    readonly stop: () => void;
  };
  createLocationTracker(deps: TrackerDeps): LocationTracker
  ```
  `TrackerDeps` injects the geolocation adapter (`getCurrentPosition`, `watchPosition`,
  `clearWatch`), `permissionState(): Promise<PermissionState | 'unknown'>` (wraps
  `navigator.permissions.query({ name: 'geolocation' })`; Safari is inconsistent, so
  `'unknown'` and `'prompt'` both mean "try"), `now`, visibility (`document`), and the
  timing constants. Keep the pure state transitions as standalone functions in the same
  file so they read as a state machine.
  - `start()`: availability check (API present + secure context) → `failed(not-supported)`;
    permission `denied` → `failed(permission-denied)` without prompting; otherwise
    `acquiring` and **two-phase acquisition**: one `getCurrentPosition` with
    `QUICK_FIX_OPTIONS` (`enableHighAccuracy: false, maximumAge: 60_000, timeout: 5_000`)
    for a fast first fix, plus `watchPosition` with `WATCH_OPTIONS`
    (`enableHighAccuracy: true, maximumAge: 0, timeout: 20_000`). A fix is accepted when its
    `at` is newer than the current one; quick-fix errors are ignored when the watch has
    already delivered.
  - Watch errors: `PERMISSION_DENIED` → `failed`, watch cleared. `TIMEOUT` /
    `POSITION_UNAVAILABLE` while tracking → stay `tracking` with `freshness: 'stale'`;
    with no position yet → `failed` with that error, watch cleared.
  - Staleness timer: `POSITION_STALE_AFTER_MS` (30 s) without a fix → `stale`.
  - `visibilitychange`: hidden while acquiring/tracking → clear watch, `paused`; visible
    again → `start()` again (from `paused` only).
  - `stop()` clears everything → `idle`.
- `last-known.ts` — `loadLastKnownPosition(storage, now): UserPosition | null` and
  `saveLastKnownPosition(storage, position)` on `localStorage` key
  `gribudzert.lastPosition`, JSON validated field by field through the branded constructors,
  discarded when older than `LAST_POSITION_MAX_AGE_MS` (7 days) or malformed. Save on every
  accepted fix (throttle is unnecessary; it is one small write).
- `user-marker.ts` — `createUserLocationLayer(map)`, `showUserPosition(layer, position,
  freshness)`, `hideUserPosition(layer)`. `L.divIcon` root class `user-location-marker`
  with children `.user-location-halo`, `.user-location-dot`, `.user-location-heading`;
  root carries `data-freshness="live" | "stale"` and `data-moving="true" | "false"`, heading
  as CSS custom property `--heading: <deg>deg` on the root. Updating an existing marker
  uses `setLatLng` and mutates attributes on `marker.getElement()`; the accuracy `L.circle`
  is updated with `setLatLng` / `setRadius` and removed when accuracy > 500 m. Keep the
  circle stroke colour `#136AEC` (tests select it). Popup: `You are here (±25 m)`, plus
  ` · 9.4 km/h` when moving.
- `beeline.ts` — `createBeelineLayer(map)`, `showBeeline(layer, from: LatLon, to: LatLon)`,
  `clearBeeline(layer)`. `L.polyline` with `className: 'beeline'`, `interactive: false`,
  `dashArray: '6 6'`, `weight: 2`, `color: '#136AEC'`, `opacity: 0.7`; updated with
  `setLatLngs` when it already exists.
- `follow.ts` — `FollowMode = 'off' | 'on'`, `createFollowController(map, tracker,
  onModeChange)` with `follow()` / `unfollow()` / `mode()`. On tracker `tracking` state and
  mode `on` → `map.panTo(position, { animate: true, duration: 0.5 })`. Leaves follow mode on
  `dragstart` and on `keydown` with an arrow key on the map container. Sets a
  `programmaticMove` guard so its own pans are not mistaken for user moves. Follow-mode
  entry from the button uses `flyTo` at `max(zoom, LOCATE_ZOOM)`; startup entry uses
  `setView` (rule 3).
- `geolocation.ts` — delete; its remaining pure helpers (`mapGeolocationError`,
  `locationErrorMessage`) move to `tracker.ts` / `messages.ts`. Nothing else imports it
  after the change. Delete `GEOLOCATION_OPTIONS`, `LOCATION_TIMEOUT`,
  `LOCATION_HIGH_ACCURACY` from `core/config.ts`.
- `location.css` (new, imported from the feature's entry module) holds all user-marker,
  beeline, HUD and locate-button styles. Remove the obsolete `.locate-control` block from
  `index.html`; leave every other rule in `index.html` alone.

### UI — `src/ui/`

- `locate-control.ts` — `createLocateControl(deps)` where deps expose `onActivate()` and
  a `render(view: LocateButtonView)` is exposed back for the app to push state:
  ```ts
  type LocateButtonView =
    | { readonly kind: 'idle' }
    | { readonly kind: 'acquiring' }
    | { readonly kind: 'tracking'; readonly follow: FollowMode }
    | { readonly kind: 'blocked' }
    | { readonly kind: 'failed' };
  ```
  Root keeps class `locate-control`; the button element keeps `aria-label="Show my location"`
  except in the `blocked` state (rule 12). Use `<button type="button">` rather than `<a>`.
- `nearest-hud.ts` — `createNearestHud(map, onActivate)` returning `{ render(view) }` with
  ```ts
  type NearestHudView =
    | { readonly kind: 'hidden' }
    | { readonly kind: 'shown'; readonly distance: Meters; readonly bearing: Heading; readonly glyph: string; readonly label: string };
  ```
  A Leaflet control at `bottomleft` is fine as long as CSS centres it; a plain
  `<button class="nearest-hud">` appended to the map container is also fine. Text content
  exactly `Nearest water · 350 m · NE` (arrow is a separate `aria-hidden` element rotated
  with `--bearing`). `aria-live="polite"`.

### App wiring — `src/app/`

- `session.ts`: `userLocation: UserPosition | null`; add `rankedFrom: LatLon | null` (origin
  of the last ranking), `popupOpen: boolean`, `followMode: FollowMode`, `nearestWater:
  Located<WaterFacility> | null`. Add transitions `withPosition`, `withRankedFrom`,
  `withPopupOpen`, `withFollowMode`, `withNearestWater`, and the predicate
  `needsReranking(state, position): boolean` (moved ≥ `RERANK_MIN_MOVE_M` from `rankedFrom`,
  or never ranked, and no popup open). `resolveOrigin` unchanged in spirit.
- `explore.ts`: `ExploreDeps` gains `reportNearest: (kind: LayerKind, nearest:
  Located<Facility> | null) => void`; `handleOutcome` calls it for `loaded` (with
  `nearestOf(items)`) and `empty` (with `null`). Bootstrap uses it to update
  `nearestWater`, the HUD and the beeline. `viewportOf` unchanged.
- `bootstrap.ts`: restructure `bootstrapOrThrow` so the map exists before any geolocation
  call. Order: load last-known → create map → layers/cache/session → controls → start
  tracker → subscribe: on every `tracking` state update the dot, save last-known, update
  session, update HUD/beeline from the cached `nearestWater`, and call `exploreSafely` when
  `needsReranking`. `trackMapLoaded('user')` when the map was centred on a remembered or
  fresh position, `('default')` when the startup attempt failed with nothing remembered;
  exactly once. Keep the file readable by extracting `wireLocation(app, map, …)`.

### Config — `src/core/config.ts`

`LOCATE_ZOOM = 15`, `QUICK_FIX_OPTIONS`, `WATCH_OPTIONS`, `POSITION_STALE_AFTER_MS = 30_000`,
`RERANK_MIN_MOVE_M = 25`, `ACCURACY_CIRCLE_MAX_M = 500`, `MOVING_SPEED_THRESHOLD_MPS = 0.5`,
`LAST_POSITION_STORAGE_KEY = 'gribudzert.lastPosition'`,
`LAST_POSITION_MAX_AGE_MS = 7 days` (as `DurationMs`).

## Tests (integration only, through `renderApp`)

No unit tests. Every behaviour above is exercised through the entry point, in the voice of
the existing scenario files (a sentence of context at the top, `it` names that read as
user stories).

Harness (`tests/harness.ts`) changes, owned by the location agent:

- `fakeGeolocation`: real `watchPosition` (delivers the current outcome asynchronously,
  returns an id), `clearWatch`, `respondWith` also delivers to active watchers (this is how a
  test "moves" the runner); expose `watchers` (active watch count) and keep `requests`
  counting `getCurrentPosition` calls. Add `moveTo(position)` as the readable alias.
- `markers()` selects `.leaflet-marker-pane .facility-marker`; `userLocation()` counts
  `.user-location-marker` and the `#136AEC` circle paths.
- `hud()` returns the HUD text or `null`; `beelineVisible()`; `locateButton()` returns the
  button element; `pressArrowKey(direction)` on the map container.
- `localStorage.clear()` in `tests/setup.ts` `afterEach`; `renderApp` option
  `permission?: 'granted' | 'denied' | 'prompt'` installing a `navigator.permissions.query`
  fake (default `'prompt'`); option `rememberedPosition?` seeding `localStorage`.

Scenarios to add or update:

- `arriving-at-the-map.test.ts`: the map is created before the fix resolves (hold the fix
  with a never-resolving outcome and assert the Leaflet container exists and Riga is
  requested); after the fix it re-centres and ranks from the runner. Update the fallback
  toast expectation (rule 4).
- `showing-my-location.test.ts`: rewrite for rules 12–13: no success toast; one dot however
  often pressed; denied → blocked state and toast on click; `aria-pressed` toggling.
- `following-my-run.test.ts` (new): moving the runner moves the dot; nearest re-ranks after
  ≥ 25 m; does not re-rank while a popup is open, then does on close; HUD text updates;
  beeline present; keyboard pan leaves follow mode and the button re-enters it; stale after
  30 s with fake timers; hidden tab clears the watch and visible restarts it.
- `remembering-where-i-was.test.ts` (new): a remembered position centres the map instantly
  and no fallback toast appears when the fix then fails; a stale (8-day) memory is ignored.
- `analytics.test.ts`: `map_loaded` still `user` for the default scenario.
- Existing scenarios must keep passing; adjust only assertions that the spec changes.

## Definition of done

`yarn typecheck && yarn typecheck:tests && yarn lint && yarn test --run && yarn build` all
green, no new dependencies, no code comments added, and a manual check in the browser
preview (dev server `vite-dev`) with a simulated position.
