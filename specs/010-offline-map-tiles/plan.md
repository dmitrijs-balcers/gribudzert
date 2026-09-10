# 010 — Offline map tiles and app shell

Goal: the map keeps rendering when the network is gone or flaky, and revisiting the same
streets never re-downloads tiles the user already saw. A service worker caches the raster
tiles the user actually viewed and precaches the built app shell so the app opens offline.

Constraints from the OpenStreetMap tile usage policy (operations.osmfoundation.org/policies/tiles):

- Cache tiles honouring `Cache-Control` / `Expires`; if unreadable, keep each tile ≥ 7 days.
- Never send `Cache-Control: no-cache` or bypass caches.
- **Never prefetch.** Only tiles the user's map requested may be fetched. There is no code
  path that fetches a tile from a key; every fetch starts from a real `Request`.
- Keep enough cache that repeat views do not re-download.

Non-goals: "download area for offline" (prohibited on tile.openstreetmap.org), vector tiles,
a tile provenance indicator, update-available prompts.

Measured facts (Sept 2026): OSM sends `cache-control: max-age=72861,
stale-while-revalidate=604800, stale-if-error=604800`, `access-control-allow-origin: *`,
tiles are 2–14 KB around Riga.

## Conventions (same as the rest of the codebase)

- Branded types for every unit, validated constructors returning `T | null`, `Result` from
  `src/types/result.ts` where an error carries information, exhaustive `switch` with a
  `never` fallthrough, no classes, no comments (names carry meaning), tabs, single quotes,
  Biome-clean. Read `src/domain/units.ts`, `src/domain/tile.ts`,
  `src/features/cache/storage.ts` and `src/app/sync/*` first and mirror their style exactly.
- Pure code has no `self`, `navigator`, `caches`, `indexedDB`, `fetch`, `Date.now()`. Those
  live only in adapters and in `src/sw.ts` / `src/app/service-worker-client.ts`.
- `lib.webworker` is NOT enabled. Do not reference `ServiceWorkerGlobalScope`, `FetchEvent`
  or `ExtendableEvent`. Use the structural types in `src/app/offline/host.ts` and cast `self`
  once in `src/sw.ts`.
- Constants live in `src/core/config.ts` (already added, do not rename):
  `TILE_HOSTS`, `TILE_CACHE_DB_NAME`, `TILE_CACHE_SCHEMA_VERSION`, `TILE_LIFETIME_FLOOR_MS`
  (7 d), `TILE_MAX_AGE_MS` (30 d), `TILE_BUDGET`, `TILE_TOUCH_INTERVAL_MS` (1 h),
  `TILE_EVICTION_EVERY_N_PUTS` (25), `SHELL_CACHE_PREFIX`, `SERVICE_WORKER_PATH`.

## Ubiquitous language

- **Map tile**: one raster PNG at `{z}/{x}/{y}`. Distinct from the existing **coverage
  tile** (`TileId`, zoom 13, unit of facility freshness). They share nothing but arithmetic.
- **Lifetime**: `freshUntil` (serve without asking) and `usableUntil` (may still be served
  while revalidating, or when the network fails). Derived once, at store time, from headers.
- **Freshness** at an instant: `fresh` / `stale` / `expired`.
- **Decision**: what the worker does for one tile request given what is stored.
- **Budget**: caps on tile count and bytes; **eviction plan** says which keys go.
- **Shell**: the built app (`/index.html`, hashed `/assets/*`, manifest, icons) for one
  **build id**. Precached at install; older builds' caches are dropped at activate.
- **Route**: which of `map-tile` / `navigation` / `shell-asset` / `passthrough` a request is.

## Module 1 — domain (pure)

### `src/domain/map-tile.ts`

```ts
export type MapTileKey = string & { readonly __brand: 'MapTileKey' };   // `${z}/${x}/${y}`
export const mapTileKey = (z: number, x: number, y: number): MapTileKey | null;
export const parseMapTileKey = (value: string): { readonly z: Zoom; readonly x: number; readonly y: number } | null;
```

`mapTileKey` requires `zoom(z) !== null`, `x` and `y` non-negative integers `< 2 ** z`.
`parseMapTileKey` accepts only `^\d+/\d+/\d+$` and re-validates through `mapTileKey`.

### `src/domain/tile-lifetime.ts`

```ts
export type CacheHeaders = { readonly cacheControl: string | null; readonly expires: string | null };
export type TileLifetime = { readonly freshUntil: Timestamp; readonly usableUntil: Timestamp };
export type LifetimeBounds = { readonly floorMs: DurationMs; readonly maxAgeMs: DurationMs };
export const lifetimeFrom = (headers: CacheHeaders, storedAt: Timestamp, bounds: LifetimeBounds): TileLifetime;
export type Freshness = 'fresh' | 'stale' | 'expired';
export const freshnessAt = (lifetime: TileLifetime, now: Timestamp): Freshness;
```

`lifetimeFrom` rules, in order:

1. `maxAge` = `max-age=N` from `cacheControl` (case-insensitive directive, `N` a non-negative
   integer) → `freshUntil = storedAt + N*1000`. Else `expires` parseable by `Date.parse` and
   ≥ `storedAt` → `freshUntil = expires`. Else `freshUntil = storedAt + floorMs`.
2. `staleWindow` = max of `stale-while-revalidate=N` and `stale-if-error=N` (each optional,
   same parsing) in ms, or `0` when neither present.
   `usableUntil = max(freshUntil + staleWindow, storedAt + floorMs)`.
3. Hard cap: both are clamped to `storedAt + maxAgeMs`; then `usableUntil = max(usableUntil, freshUntil)`.

`freshnessAt`: `now <= freshUntil` → `fresh`; `now <= usableUntil` → `stale`; else `expired`.

### `src/domain/index.ts`

Re-export everything above (types and functions), alphabetically like the rest.

## Module 2 — tiles feature: `src/features/tiles/` (pure except `store.ts`)

### `record.ts`

```ts
export type StoredTileMeta = {
	readonly key: MapTileKey;
	readonly contentType: string;         // non-empty
	readonly size: number;                // byteLength, non-negative integer
	readonly storedAt: Timestamp;
	readonly lifetime: TileLifetime;
	readonly lastUsedAt: Timestamp;
};
export type StoredTile = StoredTileMeta & { readonly bytes: ArrayBuffer };
export type StoredTileParseError =
	| { readonly reason: 'not-a-record' }
	| { readonly reason: 'version-mismatch'; readonly found: unknown }
	| { readonly reason: 'invalid-field'; readonly field: string }
	| { readonly reason: 'size-mismatch'; readonly declared: number; readonly actual: number };
export const parseStoredTile = (meta: unknown, bytes: unknown, version: SchemaVersion): Result<StoredTile, StoredTileParseError>;
export const storedTileRecord = (tile: StoredTile, version: SchemaVersion): { readonly meta: unknown; readonly bytes: ArrayBuffer };
```

The persisted meta shape is `{ version, key, contentType, size, storedAt, freshUntil,
usableUntil, lastUsedAt }` (flat). `parseStoredTile` checks version equality, `key` via
`parseMapTileKey`, timestamps via `timestamp()`, `freshUntil <= usableUntil`, `bytes` is an
`ArrayBuffer` whose `byteLength === size`. Never partially trust a record.

### `decision.ts`

```ts
export type Connectivity = 'online' | 'offline';
export type TileDecision =
	| { readonly kind: 'serve'; readonly tile: StoredTile }
	| { readonly kind: 'serve-then-revalidate'; readonly tile: StoredTile }
	| { readonly kind: 'fetch-then-fallback'; readonly fallback: StoredTile }
	| { readonly kind: 'fetch' };
export const decide = (stored: StoredTile | null, now: Timestamp, connectivity: Connectivity): TileDecision;
```

| stored | freshness | online | offline |
| --- | --- | --- | --- |
| null | – | `fetch` | `fetch` |
| tile | fresh | `serve` | `serve` |
| tile | stale | `serve-then-revalidate` | `serve` |
| tile | expired | `fetch-then-fallback` | `serve` |

Offline never produces a network decision. Serving an expired tile offline sends nothing to
the tile server and is the whole point for a trail runner without signal.

### `ledger.ts`

```ts
export type TileBudget = { readonly maxTiles: number; readonly maxBytes: number };
export type EvictionPlan = { readonly keep: readonly MapTileKey[]; readonly drop: readonly MapTileKey[] };
export const evictionPlan = (entries: readonly StoredTileMeta[], budget: TileBudget, now: Timestamp): EvictionPlan;
```

Drop every entry whose `lifetime.usableUntil < now` first. Then, while count > `maxTiles` or
total size > `maxBytes`, drop the least recently used (`lastUsedAt` ascending, ties by key
ascending for determinism). Pure; `keep ∪ drop` = input keys, disjoint.

### `route.ts`

```ts
export type RequestFacts = { readonly method: string; readonly mode: string; readonly url: URL };
export type RouteConfig = {
	readonly tileHosts: readonly string[];
	readonly shellOrigin: string;                       // e.g. self.location.origin
	readonly shellAssets: ReadonlySet<ShellAssetPath>;  // from the shell manifest, may be empty
};
export type Route =
	| { readonly kind: 'map-tile'; readonly key: MapTileKey }
	| { readonly kind: 'navigation' }
	| { readonly kind: 'shell-asset'; readonly path: ShellAssetPath }
	| { readonly kind: 'passthrough' };
export const route = (facts: RequestFacts, config: RouteConfig): Route;
```

Only `GET` is ever anything but `passthrough`. `map-tile`: `url.hostname` is in `tileHosts`
and `url.pathname` matches `^/(\d+)/(\d+)/(\d+)\.png$` with a valid `mapTileKey`.
`navigation`: `mode === 'navigate'` and `url.origin === shellOrigin`. `shell-asset`:
same origin and `url.pathname` is in `shellAssets`. Everything else (Overpass POST, umami,
unknown hosts, `/health`) is `passthrough`.

### `store.ts` (IndexedDB boundary)

```ts
export type TileStore = {
	readonly get: (key: MapTileKey) => Promise<StoredTile | null>;
	readonly put: (tile: StoredTile) => Promise<void>;
	readonly touch: (key: MapTileKey, lastUsedAt: Timestamp) => Promise<void>;
	readonly meta: () => Promise<readonly StoredTileMeta[]>;
	readonly drop: (keys: readonly MapTileKey[]) => Promise<void>;
};
export const indexedDbTileStore = (dbName?: string): TileStore;
export const memoryTileStore = (): TileStore;
```

Plain `indexedDB`, database `TILE_CACHE_DB_NAME`, version 1, two object stores keyed by
tile key: `meta` (the flat record from `storedTileRecord`) and `bytes` (`ArrayBuffer`).
`put` and `drop` write both stores in one readwrite transaction. `get` reads both, runs
`parseStoredTile`; on a parse error it logs via `utils/logger`, deletes the key (both
stores) and resolves `null`. `meta()` reads only the `meta` store and validates each record
(skip and delete invalid ones). Every failure is caught and logged: `get`/`meta` resolve
`null`/`[]`, writes resolve. The worker must never throw because storage is unavailable.
Open the database per call like `features/cache/storage.ts` does, and close it in `finally`.

### `index.ts`

Public API of the feature.

## Module 3 — shell feature: `src/features/shell/`

### `manifest.ts` (pure)

```ts
export type BuildId = string & { readonly __brand: 'BuildId' };
export type ShellAssetPath = string & { readonly __brand: 'ShellAssetPath' };  // absolute path, starts with '/'
export type ShellManifest = { readonly buildId: BuildId; readonly assets: readonly ShellAssetPath[] };
export const shellAssetPath = (value: string): ShellAssetPath | null;    // starts with '/', no '..', no '://'
export const buildId = (value: string): BuildId | null;                   // ^[a-z0-9]{8,64}$
export const parseShellManifest = (value: unknown): ShellManifest | null; // validated boundary; must contain '/index.html'
export const SHELL_ENTRY: ShellAssetPath;                                  // '/index.html'
```

### `store.ts` (Cache API boundary)

```ts
export type ShellStore = {
	readonly precache: (build: BuildId, assets: readonly ShellAssetPath[]) => Promise<void>; // rejects on failure
	readonly match: (build: BuildId, path: ShellAssetPath) => Promise<Response | null>;
	readonly dropOtherBuilds: (keep: BuildId) => Promise<void>;
};
export const cacheApiShellStore = (storage: CacheStorage, prefix?: string): ShellStore;
export const memoryShellStore = (): ShellStore;
```

Cache name is `${prefix}${build}`. `precache` = `cache.addAll(assets)` (it is correct for
install to fail when an asset is missing; the browser retries on the next load).
`dropOtherBuilds` deletes every cache whose name starts with `prefix` and is not the kept
one. `match` returns a cloned response or `null`. `memoryShellStore` keeps
`Map<string, Map<ShellAssetPath, Response>>` and lets tests seed it: expose
`seed: (build, path, response) => void` on the memory variant's return type
(`MemoryShellStore = ShellStore & { readonly seed: ... }`).

### `index.ts`

Public API.

## Module 4 — the worker: `src/app/offline/`

### `host.ts` (structural types; no webworker lib)

```ts
export type ExtendableContext = { readonly waitUntil: (task: Promise<unknown>) => void };
export type FetchContext = ExtendableContext & { readonly request: Request; readonly respondWith: (response: Promise<Response> | Response) => void };
export type ServiceWorkerHost = {
	readonly addEventListener: {
		(type: 'install', listener: (event: ExtendableContext) => void): void;
		(type: 'activate', listener: (event: ExtendableContext) => void): void;
		(type: 'fetch', listener: (event: FetchContext) => void): void;
	};
	readonly clients: { readonly claim: () => Promise<void> };
	readonly location: { readonly origin: string };
};
export const installServiceWorker = (host: ServiceWorkerHost, runtime: OfflineRuntime): void;
```

`installServiceWorker` wires: `install` → `event.waitUntil(runtime.install())`; `activate`
→ `event.waitUntil(runtime.activate().then(() => host.clients.claim()))`; `fetch` → `const
handled = runtime.fetch(event); if (handled !== null) event.respondWith(handled);`. No
`skipWaiting`: a new build waits until every tab of the old one is closed, and because
navigations are network-first the user still sees the newest HTML immediately.

### `ports.ts`

```ts
export type TileFetchOutcome =
	| { readonly kind: 'ok'; readonly bytes: ArrayBuffer; readonly contentType: string; readonly headers: CacheHeaders }
	| { readonly kind: 'opaque'; readonly response: Response }   // no-cors; serve, never store
	| { readonly kind: 'http-error'; readonly status: number }
	| { readonly kind: 'network-error' };
export type OfflinePorts = {
	readonly now: () => Timestamp;
	readonly connectivity: () => Connectivity;
	readonly fetchTile: (request: Request) => Promise<TileFetchOutcome>;   // never rejects
	readonly fetchShell: (request: Request) => Promise<Response>;          // plain network; rejects on failure
	readonly tiles: TileStore;
	readonly shell: ShellStore;
};
export type OfflineConfig = {
	readonly tileHosts: readonly string[];
	readonly shellOrigin: string;
	readonly shell: ShellManifest | null;    // null → shell caching disabled, navigations/assets passthrough
	readonly lifetime: LifetimeBounds;
	readonly budget: TileBudget;
	readonly touchIntervalMs: DurationMs;
	readonly evictionEveryNPuts: number;
};
export const networkTileFetch = (fetchFn: typeof fetch): OfflinePorts['fetchTile'];
```

`networkTileFetch(fetch)(request)`: `fetch(request)` (the original request, so `Referer`,
`mode` and `cache: 'default'` are preserved; never set no-cache). `response.type ===
'opaque'` → `opaque`. `!response.ok` → `http-error`. Else read `arrayBuffer()`, `contentType
= headers.get('content-type') ?? 'image/png'`, `headers = { cacheControl:
headers.get('cache-control'), expires: headers.get('expires') }`. Any throw → `network-error`.

### `runtime.ts`

```ts
export type OfflineRuntime = {
	readonly install: () => Promise<void>;
	readonly activate: () => Promise<void>;
	readonly fetch: (context: Pick<FetchContext, 'request' | 'waitUntil'>) => Promise<Response> | null;
};
export const createOfflineRuntime = (ports: OfflinePorts, config: OfflineConfig): OfflineRuntime;
```

Behaviour:

- `install`: if `config.shell` is null, resolve. Else `ports.shell.precache(buildId, assets)`.
- `activate`: `shell.dropOtherBuilds(buildId)` when shell present, then `enforceBudget()`.
- `fetch`: compute `route({ method, mode, url: new URL(request.url) }, ...)`.
  - `passthrough` → return `null`.
  - `navigation` (shell present, else null) → cache-first: `shell.match(buildId, SHELL_ENTRY)`;
    on a miss `fetchShell(request)`; on rejection `new Response(null, { status: 503 })`.
    Cache-first because a slow-but-alive connection never rejects a network-first fetch, so
    the user would stare at a white screen although the shell is already on the device.
    New builds reach the page through the service worker update flow instead.
  - `shell-asset` (shell present, else null) → cache-first: `shell.match(buildId, path)`;
    miss → `fetchShell(request)` (let a rejection propagate).
  - `map-tile` → `handleTile(key, request, waitUntil)`.

`handleTile`: `stored = await tiles.get(key)`; `decision = decide(stored, now(), connectivity())`.

| decision | response | side effects (through `waitUntil`) |
| --- | --- | --- |
| `serve` | `tileResponse(tile, 'cache')` | `touch` if `now - lastUsedAt >= touchIntervalMs` |
| `serve-then-revalidate` | `tileResponse(tile, 'cache')` | touch as above; `revalidate(key, request)` |
| `fetch-then-fallback` | outcome ok → `tileResponse(fresh, 'network')`; opaque → its response; http-error/network-error → `tileResponse(fallback, 'cache')` | store on ok |
| `fetch` | ok → network response; opaque → its response; http-error → `new Response(null, { status })`; network-error → `new Response(null, { status: 504 })` | store on ok |

`tileResponse(tile, source)` = `new Response(tile.bytes, { status: 200, headers: {
'Content-Type': tile.contentType, 'X-Gribudzert-Tile-Source': source } })`.

`fetchOnce(key, request)`: in-flight dedupe with `Map<MapTileKey, Promise<TileFetchOutcome>>`
so concurrent requests for one key cause one upstream fetch; entry removed when settled.

`store(key, outcome ok)`: build `StoredTile` with `storedAt = lastUsedAt = now()`, `size =
bytes.byteLength`, `lifetime = lifetimeFrom(outcome.headers, storedAt, config.lifetime)`;
`tiles.put`; increment a put counter; every `evictionEveryNPuts` puts run `enforceBudget()`.

`enforceBudget()`: `plan = evictionPlan(await tiles.meta(), config.budget, now())`; if
`plan.drop` non-empty, `tiles.drop(plan.drop)`. Serialise: if one is running, a second call
returns the same promise.

`revalidate(key, request)`: `fetchOnce` then `store` on ok; ignore other outcomes.

Nothing in this module may fetch a tile from a key alone.

## Module 5 — hosts

### `src/sw.ts`

```ts
declare const __SHELL_MANIFEST__: string;   // JSON injected by vite.sw.config.ts via `define`
```

Builds `config` (`TILE_HOSTS`, `self.location.origin`, `parseShellManifest(JSON.parse(__SHELL_MANIFEST__))`
with a `try` → `null` and a `logger.error`, `lifetime` from `TILE_LIFETIME_FLOOR_MS` /
`TILE_MAX_AGE_MS`, `TILE_BUDGET`, `TILE_TOUCH_INTERVAL_MS`, `TILE_EVICTION_EVERY_N_PUTS`),
ports (`timestampNow`, `() => navigator.onLine ? 'online' : 'offline'`,
`networkTileFetch(fetch)`, `(request) => fetch(request)`, `indexedDbTileStore()`,
`cacheApiShellStore(caches, SHELL_CACHE_PREFIX)`), then
`installServiceWorker(self as unknown as ServiceWorkerHost, createOfflineRuntime(ports, config))`.

### `src/app/service-worker-client.ts`

```ts
export const registerServiceWorker = (): void;
```

No-op unless `import.meta.env.PROD` and `'serviceWorker' in navigator`. Registers
`SERVICE_WORKER_PATH` (classic script, no `type: 'module'`), logs failures via
`utils/logger`. Called once from `bootstrap()` after the map is created.

### `src/app/bootstrap.ts`

`L.tileLayer(OSM_TILE_URL, { maxZoom: MAX_ZOOM, attribution: OSM_ATTRIBUTION, crossOrigin: 'anonymous' })`
so tile requests are CORS and the worker receives readable responses. Call `registerServiceWorker()`.

## Module 6 — build and hosting

### `vite.config.ts`

Add `build: { manifest: true }` so the asset list is written to `dist/.vite/manifest.json`.

### `vite.sw.config.ts` (new)

Second build, run after the main one. Reads `dist/.vite/manifest.json`, collects every
`file` and every entry of `css` arrays, prefixes with `/`, adds `/index.html`,
`/manifest.json`, `/favicon.svg`, `/icons/icon.svg`, sorts, dedupes. `buildId` = first 16
hex chars of `sha256` over the sorted asset list joined by `\n`. Config:

```ts
build: {
	emptyOutDir: false,
	copyPublicDir: false,
	lib: { entry: 'src/sw.ts', name: 'gribudzertServiceWorker', formats: ['iife'], fileName: () => 'sw.js' },
	rollupOptions: { output: { inlineDynamicImports: true } },
},
define: { __SHELL_MANIFEST__: JSON.stringify(JSON.stringify({ buildId, assets })) },
```

Fail the build with a clear error if the manifest file is missing. `import.meta.env.PROD`
must remain usable in the worker.

### `package.json`

`"build": "vite build && vite build --config vite.sw.config.ts"`. Nothing else changes; CI
and the Dockerfile already run `yarn build`.

### `nginx.conf`

- Define the CSP once: `set $csp "..."` at server level, and every `add_header
  Content-Security-Policy $csp always;` uses it (the four copies become one string).
- Add `https://tile.openstreetmap.org https://*.tile.openstreetmap.org` to `connect-src`
  (the worker's `fetch()` for tiles is governed by the worker's own CSP).
- Add `location = /sw.js { add_header Cache-Control "no-cache" always; + the full security
  header set }` so the worker is never served immutable. `location =` beats the regex block.

### `README.md`

One short section "Offline": what is cached (viewed tiles, app shell), what is not (no area
download, per OSM policy), and the two-step build.

## Module 7 — tests (`tests/`)

Integration tests only, through the worker's entry point: build a fake `ServiceWorkerHost`,
call `installServiceWorker(host, createOfflineRuntime(ports, config))`, then dispatch fake
`install` / `activate` / `fetch` events and observe responses, stores and fetch calls.
No test imports `decide`, `evictionPlan`, `lifetimeFrom` or `route` directly.

### `tests/offline-harness.ts`

```ts
export type TileReply = { readonly status?: number; readonly bytes?: ArrayBuffer; readonly headers?: Partial<CacheHeaders> } | 'network-error' | 'opaque';
export type OfflineWorker = {
	readonly install: () => Promise<void>;
	readonly activate: () => Promise<void>;
	readonly request: (input: string | Request, init?: { mode?: string }) => Promise<Response | null>; // null = passthrough
	readonly settle: () => Promise<void>;               // await every waitUntil task
	readonly tileFetches: readonly string[];            // upstream tile URLs fetched, in order
	readonly shellFetches: readonly string[];
	readonly tiles: TileStore;                          // indexedDbTileStore over fake-indexeddb
	readonly shell: MemoryShellStore;
	readonly clock: { now: () => Timestamp; advance: (ms: number) => void; set: (ms: number) => void };
	readonly goOffline: () => void;
	readonly goOnline: () => void;
	readonly replyToTiles: (handler: (url: URL) => TileReply | Promise<TileReply>) => void;
	readonly replyToShell: (handler: (url: URL) => Response | Promise<Response> | 'network-error') => void;
};
export const startWorker = (options?: { budget?: TileBudget; shell?: ShellManifest | null; evictionEveryNPuts?: number }): OfflineWorker;
export const OSM_HEADERS: CacheHeaders;   // the measured values above
export const tileUrl = (z: number, x: number, y: number): string;
export const pngBytes = (fill: number, size?: number): ArrayBuffer;
```

Default shell manifest for tests: `{ buildId: 'abcdef0123456789', assets: ['/index.html', '/assets/index-abc.js', '/assets/index-abc.css', '/manifest.json'] }`.
Default tile reply: 200, 8 KB, `OSM_HEADERS`. Default connectivity online.

### Stories (one file each, `tests/integration/*.test.ts`)

`running-the-same-streets-again.test.ts`
- first request for a tile goes upstream once, responds with the bytes and `X-Gribudzert-Tile-Source: network`;
- the same tile requested again within max-age is served from cache with no upstream fetch;
- two concurrent requests for one tile cause one upstream fetch;
- only tiles that were requested are ever fetched (request 3 tiles, `tileFetches` has exactly those 3);
- an upstream tile fetch is the original request (the fake sees `cache` !== 'no-cache' and the same URL).

`seeing-the-map-without-signal.test.ts`
- offline, a stale tile is served from cache and nothing is fetched;
- offline, an expired tile (past usableUntil) is still served, nothing fetched;
- offline, an unknown tile responds 504 and nothing is stored;
- online again, the stale tile is served immediately and refreshed in the background (after `settle`, the stored bytes are the new ones).

`keeping-tiles-fresh.test.ts`
- past max-age but within stale-while-revalidate: served from cache immediately, one background fetch, store updated;
- past usableUntil online: network first; on network error the old tile is served with source `cache`;
- upstream 404 for an unknown tile responds 404 and stores nothing;
- upstream 500 for an expired tile serves the fallback;
- an opaque upstream response is passed through and not stored.

`honouring-the-tile-server-headers.test.ts`
- with OSM headers a tile stays fresh for max-age and is not refetched until then;
- with no cache headers at all a tile is not refetched for 7 days;
- with `max-age=60` the tile is revalidated after 61 s (headers honoured when shorter);
- nothing is kept past 30 days: after 31 days online the tile is fetched first, and eviction on activate drops it.

`staying-within-the-tile-budget.test.ts` (small budget, `evictionEveryNPuts: 1`)
- with `maxTiles: 3`, requesting 5 distinct tiles keeps the 3 most recently used;
- with `maxBytes` smaller than two tiles, only the newest stays;
- expired tiles are dropped before any fresh tile regardless of use order;
- `activate` enforces the budget.

`leaving-other-traffic-alone.test.ts`
- Overpass POST, umami script, `/health`, unknown host image, tile URL with a non-PNG path or out-of-range x/y → passthrough (`null`), nothing fetched, nothing stored.

`opening-the-app-after-a-deploy.test.ts`
- `install` precaches every manifest asset;
- online navigation goes to the network and returns the network HTML;
- offline navigation returns the precached `/index.html`;
- a hashed asset is served from the shell cache without a network fetch;
- `activate` drops caches of other builds and keeps this one;
- with an invalid manifest (`shell: null`) navigations and assets are passthrough.

`recovering-from-a-corrupt-tile-record.test.ts`
- a meta record with the wrong version is treated as a miss, fetched again and replaced;
- a bytes record whose length does not match `size` is treated as a miss;
- storage that throws on open never breaks a response (tile still comes from the network).

`loading-map-tiles.test.ts` (through the existing `renderApp` harness)
- tile images are requested with `crossOrigin === 'anonymous'`.

### Known flake (pre-existing on `main`, not introduced here)

The worker running `knowing-how-fresh-the-points-are.test.ts` sometimes dies with a
JavaScript heap out-of-memory error in its fourth test, only under the parallel load of the
full suite; the file alone never fails. Measured on Sept 7 2026: `main` crashed 1 of 6 runs
under a 384 MB heap, this branch about 1 in 2 under the default heap (more files, more load).
A heap snapshot at the limit holds ~3 million Leaflet `Point` objects in a few arrays, i.e.
the tile grid enumerating a world-sized tile range in `GridLayer._update`. Adding
`shouldAdvanceTime: true` to the Date-only fake timers did not change the rate and was
reverted. Running test files sequentially (`fileParallelism: false` in `vitest.config.ts`)
never crashed in 5 runs and costs only a few seconds, so that is the mitigation in place.
Root cause is still open; see the follow-up task.

## Definition of done

`yarn typecheck && yarn typecheck:tests && yarn lint && yarn test --run && yarn build` all
green; `dist/sw.js` exists and contains the injected manifest with `/index.html`; no new
runtime dependency.
