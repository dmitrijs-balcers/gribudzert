/**
 * Offline facility cache snapshot
 * The whole cache is one serialisable value: which tiles have been fetched for which facility
 * kinds and when, and which facilities live in each tile. Pure and storage-agnostic -
 * `storage.ts` is the only place that touches IndexedDB, and `parseSnapshot` here is the
 * validated boundary for whatever a boundary like that hands back.
 */

import { CACHE_TILE_ZOOM, FACILITY_CACHE_SCHEMA_VERSION } from '../../core/config';
import type { Coordinates, Facility, FacilityId, FacilityKind, OsmRef, TileId } from '../../domain';
import { coordinates, facilityId, parseTileId, tileOf } from '../../domain';

/**
 * Branded milliseconds-since-epoch, as returned by `Date.now()`
 */
export type Timestamp = number & { readonly __brand: 'Timestamp' };

/**
 * When a tile was last fetched from Overpass, per facility kind - a tile can be fresh for one
 * kind and stale or never-fetched for another, since a single fetch only ever asks for the
 * kinds that were actually active at the time.
 */
export type TileCoverage = Readonly<Partial<Record<FacilityKind, Timestamp>>>;

/**
 * A cached facility together with the tile it belongs to (its coordinates' tile at
 * `CACHE_TILE_ZOOM`), so eviction and reconciliation can act per tile without recomputing it
 */
export type CachedFacility = { readonly tile: TileId; readonly facility: Facility };

/**
 * The entire offline facility cache, persisted as one record
 */
export type Snapshot = {
	readonly version: number;
	readonly tiles: Readonly<Record<TileId, TileCoverage>>;
	readonly facilities: Readonly<Record<FacilityId, CachedFacility>>;
};

/**
 * A cache with nothing fetched yet, at the current schema version
 */
export const emptySnapshot = (): Snapshot => ({
	version: FACILITY_CACHE_SCHEMA_VERSION,
	tiles: {},
	facilities: {},
});

/**
 * How trustworthy a tile's cached data is, for one facility kind
 */
export type TileStatus = 'fresh' | 'stale' | 'missing';

/**
 * Status of one tile for one facility kind: `missing` when that kind was never fetched there,
 * `fresh` when fetched within `ttlMs` of `now`, `stale` otherwise
 */
export const tileStatus = (
	snapshot: Snapshot,
	tile: TileId,
	kind: FacilityKind,
	now: number,
	ttlMs: number
): TileStatus => {
	const fetchedAt = snapshot.tiles[tile]?.[kind];
	if (fetchedAt === undefined) {
		return 'missing';
	}
	return now - fetchedAt <= ttlMs ? 'fresh' : 'stale';
};

/**
 * What a viewport needs, split out from what is already trustworthy
 */
export type Lookup = {
	/** Every cached facility inside `tiles` whose kind is in `kinds` */
	readonly facilities: readonly Facility[];
	/** Tiles where at least one of `kinds` has coverage - something was fetched there for at
	 * least one requested kind */
	readonly known: readonly TileId[];
	/** Tiles where at least one of `kinds` is stale or missing - Overpass should be asked
	 * about these (for every kind in `kinds`, since one request always covers all of them) */
	readonly toFetch: readonly TileId[];
};

/**
 * Split `tiles` into what is already known and what still needs fetching for `kinds`, and
 * collect every cached facility of one of those kinds that falls inside them
 */
export const lookup = (
	snapshot: Snapshot,
	tiles: readonly TileId[],
	kinds: readonly FacilityKind[],
	now: number,
	ttlMs: number
): Lookup => {
	const tileSet = new Set(tiles);
	const kindSet = new Set(kinds);
	const known: TileId[] = [];
	const toFetch: TileId[] = [];

	for (const tile of tiles) {
		const statuses = kinds.map((kind) => tileStatus(snapshot, tile, kind, now, ttlMs));
		if (statuses.some((status) => status !== 'missing')) {
			known.push(tile);
		}
		if (statuses.some((status) => status !== 'fresh')) {
			toFetch.push(tile);
		}
	}

	const facilities = Object.values(snapshot.facilities)
		.filter((cached) => tileSet.has(cached.tile) && kindSet.has(cached.facility.kind))
		.map((cached) => cached.facility);

	return { facilities, known, toFetch };
};

/**
 * Drop every cached facility inside `tiles` whose kind is in `kinds`, add `facilities` under
 * their own tile, and stamp `tiles[tile][kind] = now` for every tile in `tiles` and kind in
 * `kinds` - other kinds' stamps on those tiles, and everything outside `tiles`, are untouched.
 * An Overpass bbox is inclusive, so a response can carry points from a tile that was not part
 * of this fetch; those are kept under their own tile without stamping it.
 */
export const reconcile = (
	snapshot: Snapshot,
	tiles: readonly TileId[],
	kinds: readonly FacilityKind[],
	facilities: readonly Facility[],
	now: number
): Snapshot => {
	const tileSet = new Set(tiles);
	const kindSet = new Set(kinds);

	const kept: Record<FacilityId, CachedFacility> = {};
	for (const [id, cached] of Object.entries(snapshot.facilities) as [
		FacilityId,
		CachedFacility,
	][]) {
		if (!(tileSet.has(cached.tile) && kindSet.has(cached.facility.kind))) {
			kept[id] = cached;
		}
	}
	for (const facility of facilities) {
		kept[facility.id] = { tile: tileOf(facility.coordinates, CACHE_TILE_ZOOM), facility };
	}

	const stamps = Object.fromEntries(kinds.map((kind) => [kind, now as Timestamp]));
	const stampedTiles: Record<TileId, TileCoverage> = { ...snapshot.tiles };
	for (const tile of tiles) {
		stampedTiles[tile] = { ...stampedTiles[tile], ...stamps };
	}

	return { version: snapshot.version, tiles: stampedTiles, facilities: kept };
};

/**
 * Merge two snapshots taken at different times: for every (tile, kind) pair `overlay` covers,
 * its stamp replaces `base`'s and every `base` facility of that kind inside that tile is
 * dropped before `overlay`'s facilities are added; a (tile, kind) pair only `base` covers is
 * left alone. Used when the persisted snapshot finishes loading after the in-memory cache
 * already absorbed a fetch, so the load completing never discards data that is newer than what
 * was on disk.
 */
export const mergeSnapshots = (base: Snapshot, overlay: Snapshot): Snapshot => {
	const tileIds = new Set<TileId>([
		...(Object.keys(base.tiles) as TileId[]),
		...(Object.keys(overlay.tiles) as TileId[]),
	]);

	const tiles: Record<TileId, TileCoverage> = {};
	for (const tile of tileIds) {
		tiles[tile] = { ...base.tiles[tile], ...overlay.tiles[tile] };
	}

	const facilities: Record<FacilityId, CachedFacility> = {};
	for (const [id, cached] of Object.entries(base.facilities) as [FacilityId, CachedFacility][]) {
		const overlayCoversKind = overlay.tiles[cached.tile]?.[cached.facility.kind] !== undefined;
		if (!overlayCoversKind) {
			facilities[id] = cached;
		}
	}
	for (const [id, cached] of Object.entries(overlay.facilities) as [FacilityId, CachedFacility][]) {
		facilities[id] = cached;
	}

	return { version: overlay.version, tiles, facilities };
};

/**
 * A tile's age for eviction purposes: the most recent of its per-kind fetch stamps
 */
const newestStampOf = (coverage: TileCoverage): number => {
	const stamps = Object.values(coverage) as Timestamp[];
	return stamps.length === 0 ? Number.NEGATIVE_INFINITY : Math.max(...stamps);
};

/**
 * Drop the oldest-fetched tiles (and every facility that belonged only to them) beyond
 * `maxTiles`, oldest meaning the tile's newest per-kind stamp. A no-op when the cache is
 * already within budget.
 */
export const evict = (snapshot: Snapshot, maxTiles: number): Snapshot => {
	const entries = Object.entries(snapshot.tiles) as [TileId, TileCoverage][];
	if (entries.length <= maxTiles) {
		return snapshot;
	}

	const oldestFirst = [...entries].sort((a, b) => newestStampOf(a[1]) - newestStampOf(b[1]));
	const dropCount = entries.length - maxTiles;
	const dropped = new Set(oldestFirst.slice(0, dropCount).map(([tile]) => tile));

	const tiles: Record<TileId, TileCoverage> = {};
	for (const [tile, coverage] of entries) {
		if (!dropped.has(tile)) {
			tiles[tile] = coverage;
		}
	}

	const facilities: Record<FacilityId, CachedFacility> = {};
	for (const [id, cached] of Object.entries(snapshot.facilities) as [
		FacilityId,
		CachedFacility,
	][]) {
		if (!dropped.has(cached.tile)) {
			facilities[id] = cached;
		}
	}

	return { version: snapshot.version, tiles, facilities };
};

// ---------------------------------------------------------------------------
// Validated boundary: parsing whatever storage handed back
// ---------------------------------------------------------------------------

type UnknownRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isFacilityKind = (value: unknown): value is FacilityKind =>
	value === 'water' || value === 'toilet';

/**
 * Parse a per-kind tile coverage record: every key must be a valid facility kind, every value
 * a finite number
 */
const parseTileCoverage = (value: unknown): TileCoverage | null => {
	if (!isRecord(value)) {
		return null;
	}
	const coverage: Record<FacilityKind, Timestamp> = {} as Record<FacilityKind, Timestamp>;
	for (const [kind, fetchedAt] of Object.entries(value)) {
		if (!isFacilityKind(kind)) {
			return null;
		}
		if (typeof fetchedAt !== 'number' || !Number.isFinite(fetchedAt)) {
			return null;
		}
		coverage[kind] = fetchedAt as Timestamp;
	}
	return coverage;
};

/**
 * Parse the `tiles` record: every key must be a valid TileId, every value a valid coverage
 */
const parseTiles = (value: unknown): Readonly<Record<TileId, TileCoverage>> | null => {
	if (!isRecord(value)) {
		return null;
	}
	const tiles: Record<TileId, TileCoverage> = {};
	for (const [id, raw] of Object.entries(value)) {
		if (parseTileId(id) === null) {
			return null;
		}
		const coverage = parseTileCoverage(raw);
		if (coverage === null) {
			return null;
		}
		tiles[id as TileId] = coverage;
	}
	return tiles;
};

/**
 * Parse an OSM reference (`{ type, id }`)
 */
const parseOsmRef = (value: unknown): OsmRef | null => {
	if (!isRecord(value)) {
		return null;
	}
	const type = value.type;
	const id = value.id;
	if (typeof id !== 'number' || !Number.isFinite(id)) {
		return null;
	}
	if (type === 'node' || type === 'way' || type === 'relation') {
		return { type, id };
	}
	return null;
};

/**
 * Parse a coordinate pair, validated through `coordinates()`
 */
const parseCoordinates = (value: unknown): Coordinates | null => {
	if (!isRecord(value)) {
		return null;
	}
	const lat = value.lat;
	const lon = value.lon;
	if (typeof lat !== 'number' || typeof lon !== 'number') {
		return null;
	}
	return coordinates(lat, lon);
};

/**
 * Parse one `{ tile, facility }` entry. Only the fields that matter for trust are checked -
 * `id` matches `facilityId(osm)`, `kind` is a known kind, `coordinates` are valid and land in
 * `tile` - the rest of the facility shape is trusted, guarded instead by the schema version.
 */
const parseCachedFacility = (value: unknown): CachedFacility | null => {
	if (!isRecord(value)) {
		return null;
	}
	const tile = value.tile;
	if (typeof tile !== 'string' || parseTileId(tile) === null) {
		return null;
	}

	const facility = value.facility;
	if (!isRecord(facility)) {
		return null;
	}

	const osm = parseOsmRef(facility.osm);
	if (osm === null || facility.id !== facilityId(osm)) {
		return null;
	}
	if (!isFacilityKind(facility.kind)) {
		return null;
	}

	const coords = parseCoordinates(facility.coordinates);
	if (coords === null || tileOf(coords, CACHE_TILE_ZOOM) !== tile) {
		return null;
	}

	return { tile: tile as TileId, facility: facility as unknown as Facility };
};

/**
 * Parse the `facilities` record: every key must equal the entry's own facility id
 */
const parseFacilities = (value: unknown): Readonly<Record<FacilityId, CachedFacility>> | null => {
	if (!isRecord(value)) {
		return null;
	}
	const facilities: Record<FacilityId, CachedFacility> = {};
	for (const [id, raw] of Object.entries(value)) {
		const cached = parseCachedFacility(raw);
		if (cached === null || cached.facility.id !== id) {
			return null;
		}
		facilities[id as FacilityId] = cached;
	}
	return facilities;
};

/**
 * Validated boundary for whatever came out of storage: a wrong version, a malformed shape,
 * or a single malformed facility discards the whole snapshot rather than partially trusting
 * it - a corrupt cache should behave like an empty one, never like a broken one.
 */
export const parseSnapshot = (value: unknown, expectedVersion: number): Snapshot | null => {
	if (!isRecord(value) || value.version !== expectedVersion) {
		return null;
	}
	const tiles = parseTiles(value.tiles);
	if (tiles === null) {
		return null;
	}
	const facilities = parseFacilities(value.facilities);
	if (facilities === null) {
		return null;
	}
	return { version: expectedVersion, tiles, facilities };
};
