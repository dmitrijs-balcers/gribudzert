# 011 — One-hand zoom on mobile

## Why

A runner or dog-walker checking the map one-handed cannot pinch-zoom: pinch needs a second
free hand. Leaflet's touch zoom control offers no one-handed alternative beyond the tiny
`+`/`-` buttons, which are slow and easy to miss on a moving trail. A "double-tap, keep the
finger down, then slide" gesture — the pattern popularised by Google Maps, but with the
vertical direction reversed to match how a thumb naturally drags down to bring things
closer — lets a runner zoom with the same hand that is holding the phone.

Target browsers are current versions only (Chrome, Safari, mobile Safari/Chrome). The
gesture is offered only on coarse-pointer (touch) devices; desktop keeps the existing
zoom control and mouse-wheel zoom untouched.

## Behaviour (user's point of view)

1. Tap, then tap again within 300 ms and within 30 px of the first tap, and keep the second
   finger down. Sliding the finger vertically then zooms: **down zooms in, up zooms out**
   (the reverse of Google Maps, deliberately, per Gribudzert's convention).
2. 150 px of vertical movement from the second tap equals one zoom level. The zoom is
   continuous (fractional) while dragging, not stepped, and clamps to the map's min/max
   zoom the same way any other zoom does.
3. The zoom anchors on the point of the second tap: whatever was under that finger stays
   under it as the map scales.
4. If the second tap lifts without sliding more than ~10 px, it is a plain double tap: the
   map zooms in one level (`zoomDelta`) around the tap point, animated, as in other map
   apps. Leaflet's own `doubleClickZoom` is switched off on coarse pointers so a browser-
   synthesised `dblclick` cannot zoom a second time.
5. If the finger moves more than 30 px before the second tap lands, the gesture never arms:
   it was a pan, not a double-tap-and-slide, and normal one-finger panning proceeds
   untouched.
6. A second finger touching down at any point (a pinch) cancels the gesture immediately;
   Leaflet's native pinch-zoom is never interfered with.
7. While the gesture is live, the map does not pan out from under the sliding finger:
   `map.dragging` is disabled for the duration and re-enabled the moment the gesture ends
   (lift, cancel, or a second finger arriving).
8. The gesture is offered only when the primary pointer is coarse (`(pointer: coarse)`).
   On such devices Leaflet's own `+`/`-` zoom control is hidden (`zoomControl: false`) —
   it would otherwise sit uselessly beside a gesture that replaces it. Fine-pointer
   (desktop/mouse) sessions are completely unaffected: control shown, no listeners
   attached, `zoomSnap` untouched.
9. Starting the gesture (the moment the second tap is confirmed and dragging is disabled)
   counts as a manual map interaction: it leaves follow mode, the same as a drag or an
   arrow-key pan does.

## Architecture

Follows the constitution and the existing style: discriminated unions tagged with `kind`,
`readonly` everywhere, a pure `reduce` function mirroring `src/app/sync/reducer.ts` +
`runtime.ts` (state/effects computed by a pure core, a thin adapter runs the effects).

### `src/core/config.ts`

Four new constants next to the existing zoom constants: `ONE_HAND_ZOOM_TAP_INTERVAL_MS`
(300, `DurationMs`), `ONE_HAND_ZOOM_TAP_SLOP_PX` (30), `ONE_HAND_ZOOM_DRAG_THRESHOLD_PX`
(10), `ONE_HAND_ZOOM_PX_PER_ZOOM_LEVEL` (150).

### `src/features/zoom-gesture/gesture.ts` (pure, no Leaflet/DOM imports)

`GestureState` is a five-way union: `idle | firstTapDown | firstTapUp | armed | dragging`.
`GestureEvent` is `pointerDown | pointerMove | pointerUp | cancel`, carrying `x`/`y` and a
`pointerCount` (the adapter's count of pointers currently down); `pointerDown` also carries
the map's current `zoom` at the moment it fires, since that is the only place the pure core
needs a live zoom value (as the baseline for the drag) without importing anything from
Leaflet. `GestureEffect` is `begin | zoomTo(anchor, zoom) | end`, exactly as specified.

`reduce(state, event, now): readonly [GestureState, readonly GestureEffect[]]` is a pure
function with one handler per state (`reduceIdle`, `reduceFirstTapDown`, ...), each an
exhaustive switch over the event with the repo's `const exhaustive: never = x; return x`
pattern. `begin` fires once, when the second tap is confirmed (matches time + position of
the first) — before it is known whether the tap will turn into a slide, so that dragging is
already disabled if it does. `end` fires whenever the gesture stops without completing a
drag transition cleanly (lift under threshold, cancel, or a second pointer). The target
`zoom` in `zoomTo` is deliberately unclamped — the adapter's call to
`map.setZoomAround` lets Leaflet's own `_limitZoom` clamp it, the same way every other
Leaflet zoom call is clamped, rather than duplicating that logic.

### `src/features/zoom-gesture/handler.ts`

`createOneHandZoomHandler(map, notifyUserMovedMap?)` returns `{ enable(), disable() }`.
Binds `pointerdown` on `map.getContainer()` and `pointermove` / `pointerup` / `pointercancel`
on `window` (a finger that slides off or lifts outside the container must still end the
gesture, otherwise `map.dragging` would stay disabled), tracks active pointer ids in a `Set`
to compute `pointerCount`, converts client coordinates to container-relative ones, and feeds
`reduce`. Running the three effect kinds: `begin(anchor)` → `map.dragging.disable()`, add the
`one-hand-zoom-active` class, `continuousZoom.start(anchor)`, call `notifyUserMovedMap()`;
`zoomTo(zoom)` → `continuousZoom.zoomTo(zoom)`; `end` → `continuousZoom.finish()`,
`map.dragging.enable()`, remove the class.

### `src/features/zoom-gesture/continuous-zoom.ts`

The zoom is applied through the same Leaflet path pinch uses, not through `setZoomAround`.
`setZoomAround({ animate: false })` is a full view reset: every call aborts each tile still
loading, removes it and requests it again. Called once per pointer move (~60/s) no tile ever
finishes, and the map stays grey for the whole slide. Pinch instead only scales the tiles
already on screen with a CSS transform while the fingers move, and loads tiles once, on lift.

`createContinuousZoom(map)` returns `{ start(anchor), zoomTo(zoom), finish() }` and mirrors
`L.Map.TouchZoom` step for step: `start` records the anchor's container point and lat/lng and
the container centre, and calls `map._stop()`; `zoomTo` clamps through `map._limitZoom`,
computes the centre that keeps the anchor's lat/lng under the anchor point (the pinch formula:
`unproject(project(anchorLatLng, zoom) - (anchor - centre), zoom)`) and schedules one
`map._move(center, zoom, { pinch: true, round: false })` per animation frame, calling
`map._moveStart(true, false)` once before the first; `finish` cancels a pending frame and
commits like pinch's touch-end: `map._animateZoom(center, zoom, true, zoomSnap)` when
`zoomAnimation` is on, else `map._resetView(center, zoom)`. These are private Leaflet 1.9.4
methods, used exactly as Leaflet's own handler uses them; the dependency is pinned and no
longer changes.

### `src/features/zoom-gesture/zoom-gesture.css`

One rule: `.leaflet-container.one-hand-zoom-active { touch-action: none !important; }`.
This turned out to matter: Leaflet's own CSS already sets `touch-action: none` on
`.leaflet-container` when both `leaflet-touch-zoom` and `leaflet-touch-drag` classes are
present (`leaflet.css` lines ~68-81), but `map.dragging.disable()` — which the gesture
calls on `begin` — removes the `leaflet-touch-drag` class, which drops the container back
to `touch-action: pan-x pan-y`. Without an explicit override the browser would then be free
to hijack the vertical slide as a scroll/pull gesture the moment dragging is disabled,
which is exactly the moment the slide needs to be captured. The `!important` makes the
override immune to CSS load-order changes rather than relying on it loading after
`leaflet.css` (which it does today, since `zoom-gesture/index.ts`'s CSS import reaches the
bundle only via `bootstrap.ts`, imported after `leaflet/dist/leaflet.css` in `src/index.ts`).

### `src/utils/dom.ts`

`isCoarsePointer(): boolean` — `matchMedia('(pointer: coarse)').matches`, `false` when
`matchMedia` does not exist.

### `src/app/bootstrap.ts`

`createMap` is split so its option-building is pure and testable:
`mapOptionsFor({ coarsePointer, center }): L.MapOptions` returns `zoomControl:
!coarsePointer` and `zoomSnap: coarsePointer ? 0 : 1` (continuous zoom while dragging one-
handed; unchanged integer-snapped zoom everywhere else, since real fractional zoom needs
`zoomSnap: 0` or Leaflet's `_limitZoom` rounds every `setZoomAround` call back to a whole
level). `bootstrapOrThrow` calls `isCoarsePointer()` once, passes it into `createMap`, and
— after the map and the new `UserInteractionSource` exist — enables
`createOneHandZoomHandler(map, userInteraction.notifyUserMovedMap)` only when coarse.

### `src/features/navigation/user-interaction.ts` (new, shared refactor)

`createUserInteractionSource(map): { onUserMovedMap(listener): unsubscribe,
notifyUserMovedMap(): void }`. Centralises what used to be `follow.ts`'s own
`map.on('dragstart', ...)` and `document.addEventListener('keydown', ...)` (arrow-key pan)
listeners into one notifier, so any feature that represents a "the user just moved the map
by hand" fact — dragging, arrow-key panning, now the one-hand zoom gesture's `begin` — can
publish into it, and anything that needs to react — today just follow mode — subscribes to
one small typed API instead of each attaching its own raw map/DOM listeners.
`createFollowController(map, tracker, userInteraction, onModeChange)` gained the
`userInteraction` parameter and lost its private `ARROW_KEYS` handling and both raw
listeners; behaviour is unchanged, confirmed by the existing "leaves follow mode on a
keyboard pan" test still passing untouched.

## Tests — `tests/integration/one-hand-zooming.test.ts`

Harness additions (`tests/harness.ts`), all additive:

- `installPointerFake('coarse' | 'fine')` stubs `window.matchMedia` so
  `(pointer: coarse)`/`(pointer: fine)` resolve as asked; `RenderOptions.pointer` calls it
  before the app is imported (defaults to `'fine'`, matching every existing test's implicit
  behaviour under happy-dom's default `matchMedia`, which always reports `matches: false`).
- `AppHandle.gesturePointer(type, {x, y}, pointerId?)` dispatches a real `PointerEvent`
  (`pointerType: 'touch'`, `isPrimary: true`) on the map container — real time (`Date.now()`)
  is used for gesture timing since a synchronous sequence of calls easily lands well inside
  the 300 ms tap window without needing fake timers.
- `AppHandle.tileZoom()` reads the zoom level back out of a rendered
  `img.leaflet-tile` src (the tile URL template embeds `{z}`) — the app exposes no map
  handle to tests, so this is the same black-box, DOM-only style the rest of the harness
  already uses (compare `loading-map-tiles.test.ts`). Leaflet keeps loaded tiles of
  neighbouring levels in the DOM until the current level has loaded (fake tile images never
  do), so the helper reads from the `.leaflet-tile-container` with the highest z-index,
  which Leaflet gives to the current level.
- `AppHandle.zoomControlVisible()` and `AppHandle.draggingEnabled()` (the latter via the
  `leaflet-grab` class Leaflet's own `Handler.Drag` toggles on enable/disable).

Scenarios: zoom increases sliding down / decreases sliding up (asserted via `tileZoom()`
after one animation frame and the lift, using exactly 150 px so the target zoom is already a
whole number, sidestepping the fact that `zoomSnap: 0` only matters for `Browser.any3d`-
detected environments and happy-dom is not one); a plain double tap with no slide zooms in
one level and leaves `dragging` enabled; two taps too far apart leave the zoom untouched;
zoom control hidden on coarse / shown on fine (two `it`s, not one — sharing one `renderApp`
across assertions in a single test also shares its `indexedDB`, so a second `renderApp` in
the same test serves the first render's facility cache and never calls Overpass); dragging
re-enabled after the gesture ends; follow mode leaves once the gesture arms.

Not covered, by explicit scope choice: the "too slow" (>300 ms) and "too far" (>30 px)
second-tap rejection paths, and the >30 px-before-second-tap pan cancellation — these are
exercised at the pure `reduce` level implicitly by the state machine's design but were not
worth a dedicated integration test on top of the five scenarios above per the task's stated
minimum coverage.

## Definition of done

`yarn typecheck && yarn typecheck:tests && yarn lint && yarn test --run` all green, `yarn
format` applied, no existing test's assertions changed, no new dependencies.
