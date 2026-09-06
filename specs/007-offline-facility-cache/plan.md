# 007 — Offline facility cache

## Goal

Facilities fetched from Overpass survive a page refresh and are shown immediately, before (and
regardless of) any network request. The network is only used to fill areas that were never
fetched or whose data is old, and the viewer keeps seeing saved points while that happens or
when it fails (offline).

Non-goals: caching map tiles, a service worker, caching raw Overpass responses (POST bodies
keyed by float bboxes never repeat, so that would never hit).

## Vocabulary

- **Tile**: a slippy-map tile at the fixed zoom `CACHE_TILE_ZOOM = 13`. The unit of coverage.
  Identified by a branded `TileId` (`"13/x/y"`). A facility belongs to the tile containing its
  coordinates.
- **Coverage**: the set of tiles we have fetched, each with a `fetchedAt` timestamp.
- **Fresh / stale / missing tile**: fetched within `FACILITY_CACHE_TTL_MS` (24 h) / fetched
  longer ago / never fetched. Stale tiles are still shown, then revalidated.
- **Snapshot**: the whole cache serialised as one object `{ version, tiles, facilities }` and
  persisted as a single IndexedDB record. Small data (a city is a few thousand points), so one
  atomic blob beats per-record stores.
- **Reconcile**: after a successful fetch for a tile-aligned bbox, every facility inside the
  fetched tiles is replaced by the response. This is what makes deleted OSM objects disappear.

## Constants (`src/core/config.ts`)

```ts
export const CACHE_TILE_ZOOM = 13;
export const FACILITY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const FACILITY_CACHE_MAX_TILES = 400; // evict oldest beyond this
export const FACILITY_CACHE_DB_NAME = 'gribudzert';
export const FACILITY_CACHE_SCHEMA_VERSION = 1; // bump whenever the persisted Facility shape changes
```

## Module 1 — tile grid: `src/domain/tile.ts` (pure)

```ts
export type TileId = string & { readonly __brand: 'TileId' };
export type TileBounds = { south: number; west: number; north: number; east: number };

export const tileOf = (point: LatLon, zoom = CACHE_TILE_ZOOM): TileId;   // lat clamped to ±85.0511
export const parseTileId = (id: string): { zoom; x; y } | null;         // validated boundary
export const tileBounds = (id: TileId): TileBounds;
export const tilesCovering = (bounds: TileBounds, zoom = CACHE_TILE_ZOOM): readonly TileId[];
export const boundsOfTiles = (ids: readonly TileId[]): TileBounds | null; // hull, tile-aligned
```

Standard slippy math: `x = floor((lon + 180) / 360 * 2^z)`,
`y = floor((1 - ln(tan(φ) + sec(φ)) / π) / 2 * 2^z)`. `tilesCovering` includes the tiles that
contain the bounds' corners and everything between. Export the types and functions from
`src/domain/index.ts`. The domain module must not import Leaflet; conversion from
`L.LatLngBounds` to `TileBounds` (and back) lives in `src/features/navigation/bounds.ts`.

## Module 2 — the cache: `src/features/cache/`

### `snapshot.ts` (pure, serialisable)

```ts
export type Timestamp = number & { readonly __brand: 'Timestamp' };
export type TileCoverage = Readonly<Partial<Record<FacilityKind, Timestamp>>>; // fetched-at per kind
export type CachedFacility = { readonly tile: TileId; readonly facility: Facility };

export type Snapshot = {
  readonly version: number;
  readonly tiles: Readonly<Record<TileId, TileCoverage>>;
  readonly facilities: Readonly<Record<FacilityId, CachedFacility>>;
};

export const emptySnapshot = (): Snapshot;
```

Coverage is tracked per facility kind, not just per tile: a tile can be fresh for water and
missing for toilets when only the water layer has ever been fetched there. This is what lets a
single layer being switched on (see `wireLayerControl` in bootstrap.ts) go through the same
cache-first flow as a full viewport refresh, instead of a bypass straight to the network - the
cache knows exactly which kinds a tile is trustworthy for.

```ts
export type TileStatus = 'fresh' | 'stale' | 'missing';
export const tileStatus = (snapshot, tile, kind: FacilityKind, now, ttlMs): TileStatus;

export type Lookup = {
  readonly facilities: readonly Facility[];   // cached facilities inside `tiles` whose kind is in `kinds`
  readonly known: readonly TileId[];          // tiles where at least one of `kinds` has coverage
  readonly toFetch: readonly TileId[];        // tiles where at least one of `kinds` is stale or missing
};
export const lookup = (snapshot, tiles: readonly TileId[], kinds: readonly FacilityKind[], now, ttlMs): Lookup;

/** Drop cached facilities inside `tiles` whose kind is in `kinds`; add `facilities` (each
 *  under its own tile); stamp `tiles[tile][kind] = now` for every tile in `tiles` and kind in
 *  `kinds`, keeping other kinds' stamps. One Overpass request always asks for every kind in
 *  `kinds`, so a kind that happened to be fresh in a fetched tile is simply refreshed too.
 *  Facilities outside `tiles` (Overpass bbox is inclusive) are kept under their own tile,
 *  but that tile's coverage is NOT stamped. */
export const reconcile = (snapshot, tiles: readonly TileId[], kinds: readonly FacilityKind[], facilities: readonly Facility[], now): Snapshot;

/** Drop the oldest-fetched tiles (and their facilities) beyond `maxTiles`; a tile's age is
 *  the newest of its per-kind stamps. */
export const evict = (snapshot, maxTiles): Snapshot;

/** Validated boundary for whatever came out of storage: wrong version, wrong shape or any
 *  malformed facility → null (the whole snapshot is discarded, never partially trusted). */
export const parseSnapshot = (value: unknown, expectedVersion: number): Snapshot | null;
```

`parseSnapshot` must check: `version === expectedVersion`; `tiles` is a record of valid tile ids
to a coverage record whose keys are each a valid `FacilityKind` and whose values are each a
finite number; every facility has a string `id` equal to `facilityId(osm)`, `kind` in
`'water' | 'toilet'`, `coordinates` that pass `coordinates()`, and a `tile` equal to
`tileOf(coordinates)`. Everything else about the facility shape is covered by the schema
version.

`mergeSnapshots(base, overlay)` merges per (tile, kind) pair: for every pair `overlay` covers,
its stamp replaces `base`'s and `base` facilities of that kind inside that tile are dropped
before `overlay`'s facilities are added; a pair only `base` covers is left alone.

### `storage.ts` (IndexedDB boundary)

```ts
export type SnapshotStore = {
  readonly load: () => Promise<Snapshot | null>;  // null when absent, unreadable or invalid
  readonly save: (snapshot: Snapshot) => Promise<void>;
};
export const indexedDbSnapshotStore = (dbName = FACILITY_CACHE_DB_NAME): SnapshotStore;
export const memorySnapshotStore = (): SnapshotStore;  // for environments without IndexedDB
export const defaultSnapshotStore = (): SnapshotStore; // IndexedDB when `indexedDB` exists, else memory
```

Plain `indexedDB` API, no library: database `dbName`, version 1, one object store `cache`,
key `'snapshot'`. Every failure (open blocked, quota, private mode throwing on access,
structured-clone error) is caught and logged with `utils/logger`; `load` then resolves `null`
and `save` resolves. The app must never break because storage is unavailable.

### `cache.ts` (the aggregate)

```ts
export type FacilityCache = {
  /** Resolve once the persisted snapshot has been loaded (or given up on). */
  readonly ready: Promise<void>;
  readonly lookup: (tiles: readonly TileId[], kinds: readonly FacilityKind[], now: number) => Lookup;
  /** Reconcile + evict in memory, then persist (fire-and-forget, serialised, errors logged). */
  readonly absorb: (
    tiles: readonly TileId[],
    kinds: readonly FacilityKind[],
    facilities: readonly Facility[],
    now: number
  ) => void;
};
export const createFacilityCache = (store: SnapshotStore, options?: { ttlMs; maxTiles }): FacilityCache;
```

Saves must not overlap: chain them on a promise so a second `absorb` waits for the first save.

### `index.ts`

Public API of the feature, like the other features.

## Module 3 — wiring

### `src/app/layers.ts`

- `RefreshOutcome.loaded` and `.empty` gain `readonly source: 'cache' | 'network'`.
- New exported `renderCached(layers, targets, facilities, origin, deps): readonly LayerRefresh[]`
  that partitions by kind and runs the same apply step as a network result but does not touch
  `inflight`. Outcomes carry `source: 'cache'`.
- `refreshLayers` is unchanged in shape except that its loaded/empty outcomes carry
  `source: 'network'`.

### `src/app/explore.ts`

`App` gains `readonly cache: FacilityCache`. `ExploreDeps` gains nothing new (the cache is on
the app; `now` already exists). There is exactly one flow, used for every call regardless of
whether `kinds` names every active layer (a viewport-wide refresh) or just one (a single layer
switched on in the layer control, see `wireLayerControl` in bootstrap.ts) - because coverage is
tracked per facility kind, a narrower `kinds` never needs to bypass the cache. After the zoom
guard:

1. `targets = activeLayers(app.layers).filter(l => kinds.includes(l.kind))`;
   `targetKinds = targets.map(l => l.kind)`. No active target: done.
2. `loadBounds = padBounds(viewport.bounds, FETCH_PADDING_FACTOR)`;
   `tiles = tilesCovering(toTileBounds(loadBounds))`.
3. `found = app.cache.lookup(tiles, targetKinds, now)`.
4. If `found.known.length > 0`: `renderCached(...)` for the targets. No notifications and no
   analytics for a cache render. The overlay is not shown for cache renders.
5. If `found.toFetch.length === 0`: done. Report `empty` from cache through `handleOutcome`
   (the empty-area notice still applies, its cooldown prevents nagging).
6. Otherwise fetch `fetchBounds = boundsOfTiles(found.toFetch)` (tile aligned, converted back
   to `L.LatLngBounds`), for `targets` only. Wrap in `withLoading` **only when nothing was
   rendered from cache** (`found.known.length === 0`): the overlay is a full-screen blocking
   dim and the whole point is seeing saved points while a refresh runs.
7. On a network `loaded`/`empty` outcome: `app.cache.absorb(found.toFetch, targetKinds, facilities, now)`
   with the fetched facility list (every kind in `targetKinds`; `found.toFetch` is exactly the
   set of tiles this fetch covered), then the existing `handleOutcome`. Note `refreshLayers`
   only renders facilities for the fetched strip; after absorbing, the view should show the
   union of cache and network for `tiles`, so after a successful fetch do one more
   `renderCached` for `tiles` from the updated cache instead of relying on the strip render.
   (Simplest correct sequence: fetch → absorb → renderCached(tiles) → handleOutcome on the
   network outcome for notifications/analytics.)
8. On a `failed` outcome when something was rendered from cache: notify
   `OFFLINE_SHOWING_SAVED_MESSAGE` as `info` instead of the error message; still log the error.
   When nothing was cached, behaviour is unchanged.

The refreshLayers fetch still exposes the full facility list only via layer outcomes. Give
`refreshLayers` a way to return the raw fetched facilities alongside the per-layer outcomes
(e.g. return `{ layers: LayerRefresh[]; fetched: readonly Facility[] | null }`) rather than
re-deriving them from outcomes.

### `src/app/messages.ts`

```ts
export const OFFLINE_SHOWING_SAVED_MESSAGE = "Couldn't refresh map data. Showing saved points.";
```

### `src/app/bootstrap.ts`

Create the cache with `defaultSnapshotStore()` before the first exploration and `await cache.ready`
(bounded: race it with a 2 s timeout so a hung IndexedDB never delays the map; log if it lost).
Navigation handlers are unchanged: they still decide "did the view leave the loaded area",
the cache decides "is a network request needed".

### `src/features/navigation/bounds.ts`

Add `toTileBounds(bounds: L.LatLngBounds): TileBounds` and `toLatLngBounds(bounds: TileBounds): L.LatLngBounds`.

## Tests (integration only, through the entry point — see `tests/harness.ts`)

### Setup changes (`tests/setup.ts`, `tests/harness.ts`)

- `import 'fake-indexeddb/auto'` at the top of `tests/setup.ts`; in `afterEach` replace
  `globalThis.indexedDB` with `new IDBFactory()` (from `'fake-indexeddb'`) so each test starts
  with empty storage, unless the test itself re-renders (see below).
- `RenderOptions` gains `readonly reload?: boolean`. When true, storage is kept (nothing reset)
  and the harness does not wait for a first Overpass request (a warm cache may not need one).
  `renderApp` today always waits for `overpass.requests.length > 0`; keep that only when
  `reload` is not set.
- Add `AppHandle.snapshot(): Promise<unknown>` that reads the raw IndexedDB record, and
  `seedSnapshot(value: unknown)` (harness export) that writes an arbitrary record, for the
  corrupt-snapshot scenario.
- For time travel use `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(...)`. Do not
  fake timers wholesale: fake-indexeddb schedules its work with real timers.

### `tests/integration/coming-back-later.test.ts`

1. **shows saved points right after a reload, before Overpass answers** — render and settle
   (3 water markers); `renderApp({ reload: true, overpass: () => pending.promise })` → the 3
   markers are on the map while no reply has arrived; no loading overlay is visible.
2. **does not ask Overpass again for an area saved recently** — reload within the TTL → after
   600 ms no request was made and the 3 markers are shown.
3. **revalidates an area saved long ago and drops points that are gone** — advance the system
   clock past the TTL, reload with Overpass answering with two of the three elements → 3
   markers immediately, then 2 once settled; the request bbox is tile aligned (its edges
   coincide with `tileBounds` of the covering tiles).
4. **keeps showing saved points when Overpass is unreachable** — stale reload with Overpass
   throwing → the 3 markers stay, the toast is the "showing saved points" info message, not the
   network error.
5. **ignores a saved snapshot it cannot trust** — seed a record with a wrong version (and one
   with garbage) → the app fetches as on a first visit and shows what Overpass returns.
6. **fetches only the strip that is not saved yet** — after the initial load, pan right twice
   (as in `moving-around.test.ts`); the second request's bbox must not include the first
   request's west edge (it starts east of it) and the map shows both the old and the new points.

Existing scenarios must keep passing with their intent intact; if an assertion needs to change
because bboxes are now tile aligned, adjust the assertion, not the intent.

## Order of work

1. Modules 1 and 2 with `parseSnapshot` and storage; test setup changes. Typecheck, lint,
   existing tests green. No behaviour change yet.
2. Module 3 wiring plus the new scenario file.
3. Review, `yarn typecheck && yarn typecheck:tests && yarn lint && npx vitest run`.
