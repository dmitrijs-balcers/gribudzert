import { CACHE_TILE_ZOOM, FACILITY_CACHE_SCHEMA_VERSION } from '../../core/config';
import type {
	DurationMs,
	Facility,
	FacilityId,
	FacilityKind,
	SchemaVersion,
	TileId,
	Timestamp,
} from '../../domain';
import { entriesOf, keysOf, parseFacility, parseTileId, timestamp, tileOf } from '../../domain';
import type { Result } from '../../types/result';
import { Err, isErr, Ok } from '../../types/result';

export type { SchemaVersion, Timestamp } from '../../domain';

export type TileCoverage = Readonly<Partial<Record<FacilityKind, Timestamp>>>;

export type CachedFacility = { readonly tile: TileId; readonly facility: Facility };

export type Snapshot = {
	readonly version: SchemaVersion;
	readonly tiles: Readonly<Record<TileId, TileCoverage>>;
	readonly facilities: Readonly<Record<FacilityId, CachedFacility>>;
};

export const emptySnapshot = (): Snapshot => ({
	version: FACILITY_CACHE_SCHEMA_VERSION,
	tiles: {},
	facilities: {},
});

export type TileStatus = 'fresh' | 'stale' | 'missing';

export const tileStatus = (
	snapshot: Snapshot,
	tile: TileId,
	kind: FacilityKind,
	now: Timestamp,
	ttlMs: DurationMs
): TileStatus => {
	const fetchedAt = snapshot.tiles[tile]?.[kind];
	if (fetchedAt === undefined) {
		return 'missing';
	}
	return now - fetchedAt <= ttlMs ? 'fresh' : 'stale';
};

export type Lookup = {
	readonly facilities: readonly Facility[];
	readonly known: readonly TileId[];
	readonly toFetch: readonly TileId[];
};

export const lookup = (
	snapshot: Snapshot,
	tiles: readonly TileId[],
	kinds: readonly FacilityKind[],
	now: Timestamp,
	ttlMs: DurationMs
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

export const reconcile = (
	snapshot: Snapshot,
	fetchedTiles: readonly TileId[],
	fetchedKinds: readonly FacilityKind[],
	fetchedFacilities: readonly Facility[],
	now: Timestamp
): Snapshot => {
	const fetchedTileSet = new Set(fetchedTiles);
	const fetchedKindSet = new Set(fetchedKinds);

	const retainedFacilities: Record<FacilityId, CachedFacility> = {};
	for (const [id, cached] of entriesOf(snapshot.facilities)) {
		if (!(fetchedTileSet.has(cached.tile) && fetchedKindSet.has(cached.facility.kind))) {
			retainedFacilities[id] = cached;
		}
	}
	for (const facility of fetchedFacilities) {
		retainedFacilities[facility.id] = {
			tile: tileOf(facility.coordinates, CACHE_TILE_ZOOM),
			facility,
		};
	}

	const freshStampByKind = Object.fromEntries(fetchedKinds.map((kind) => [kind, now]));
	const tilesWithFreshStamps: Record<TileId, TileCoverage> = { ...snapshot.tiles };
	for (const tile of fetchedTiles) {
		tilesWithFreshStamps[tile] = { ...tilesWithFreshStamps[tile], ...freshStampByKind };
	}

	return { version: snapshot.version, tiles: tilesWithFreshStamps, facilities: retainedFacilities };
};

export const mergeSnapshots = (base: Snapshot, overlay: Snapshot): Snapshot => {
	const tileIds = new Set<TileId>([...keysOf(base.tiles), ...keysOf(overlay.tiles)]);

	const tiles: Record<TileId, TileCoverage> = {};
	for (const tile of tileIds) {
		tiles[tile] = { ...base.tiles[tile], ...overlay.tiles[tile] };
	}

	const facilities: Record<FacilityId, CachedFacility> = {};
	for (const [id, cached] of entriesOf(base.facilities)) {
		const overlayCoversKind = overlay.tiles[cached.tile]?.[cached.facility.kind] !== undefined;
		if (!overlayCoversKind) {
			facilities[id] = cached;
		}
	}
	for (const [id, cached] of entriesOf(overlay.facilities)) {
		facilities[id] = cached;
	}

	return { version: overlay.version, tiles, facilities };
};

const newestStampOf = (coverage: TileCoverage): number => {
	const stamps = Object.values(coverage).filter((stamp): stamp is Timestamp => stamp !== undefined);
	return stamps.length === 0 ? Number.NEGATIVE_INFINITY : Math.max(...stamps);
};

export const evict = (snapshot: Snapshot, maxTiles: number): Snapshot => {
	const tileEntries = entriesOf(snapshot.tiles);
	if (tileEntries.length <= maxTiles) {
		return snapshot;
	}

	const tilesOldestFirst = [...tileEntries].sort(
		(a, b) => newestStampOf(a[1]) - newestStampOf(b[1])
	);
	const evictionCount = tileEntries.length - maxTiles;
	const evictedTileIds = new Set(tilesOldestFirst.slice(0, evictionCount).map(([tile]) => tile));

	const tiles: Record<TileId, TileCoverage> = {};
	for (const [tile, coverage] of tileEntries) {
		if (!evictedTileIds.has(tile)) {
			tiles[tile] = coverage;
		}
	}

	const facilities: Record<FacilityId, CachedFacility> = {};
	for (const [id, cached] of entriesOf(snapshot.facilities)) {
		if (!evictedTileIds.has(cached.tile)) {
			facilities[id] = cached;
		}
	}

	return { version: snapshot.version, tiles, facilities };
};

type UnknownRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isFacilityKind = (value: unknown): value is FacilityKind =>
	value === 'water' || value === 'toilet';

export type SnapshotParseError =
	| { readonly reason: 'not-a-record' }
	| { readonly reason: 'version-mismatch'; readonly found: unknown }
	| { readonly reason: 'invalid-tile-id'; readonly tileId: string }
	| { readonly reason: 'invalid-coverage'; readonly tileId: string }
	| { readonly reason: 'invalid-facility'; readonly facilityId: string };

const parseTileCoverage = (value: unknown): TileCoverage | null => {
	if (!isRecord(value)) {
		return null;
	}
	const coverage: Partial<Record<FacilityKind, Timestamp>> = {};
	for (const [kind, fetchedAt] of entriesOf(value)) {
		if (!isFacilityKind(kind) || typeof fetchedAt !== 'number') {
			return null;
		}
		const stamp = timestamp(fetchedAt);
		if (stamp === null) {
			return null;
		}
		coverage[kind] = stamp;
	}
	return coverage;
};

const parseTiles = (
	value: unknown
): Result<Readonly<Record<TileId, TileCoverage>>, SnapshotParseError> => {
	if (!isRecord(value)) {
		return Err({ reason: 'not-a-record' });
	}
	const tiles: Record<TileId, TileCoverage> = {};
	for (const [id, raw] of entriesOf(value)) {
		if (parseTileId(id) === null) {
			return Err({ reason: 'invalid-tile-id', tileId: id });
		}
		const coverage = parseTileCoverage(raw);
		if (coverage === null) {
			return Err({ reason: 'invalid-coverage', tileId: id });
		}
		tiles[id as TileId] = coverage;
	}
	return Ok(tiles);
};

const parseCachedFacility = (value: unknown): CachedFacility | null => {
	if (!isRecord(value)) {
		return null;
	}
	const tile = value.tile;
	if (typeof tile !== 'string' || parseTileId(tile) === null) {
		return null;
	}

	const facility = parseFacility(value.facility);
	if (facility === null || tileOf(facility.coordinates, CACHE_TILE_ZOOM) !== tile) {
		return null;
	}

	return { tile: tile as TileId, facility };
};

const parseFacilities = (
	value: unknown
): Result<Readonly<Record<FacilityId, CachedFacility>>, SnapshotParseError> => {
	if (!isRecord(value)) {
		return Err({ reason: 'not-a-record' });
	}
	const facilities: Record<FacilityId, CachedFacility> = {};
	for (const [id, raw] of entriesOf(value)) {
		const cached = parseCachedFacility(raw);
		if (cached === null || cached.facility.id !== id) {
			return Err({ reason: 'invalid-facility', facilityId: id });
		}
		facilities[id as FacilityId] = cached;
	}
	return Ok(facilities);
};

export const parseSnapshot = (
	value: unknown,
	expectedVersion: SchemaVersion
): Result<Snapshot, SnapshotParseError> => {
	if (!isRecord(value)) {
		return Err({ reason: 'not-a-record' });
	}
	if (value.version !== expectedVersion) {
		return Err({ reason: 'version-mismatch', found: value.version });
	}
	const tiles = parseTiles(value.tiles);
	if (isErr(tiles)) {
		return tiles;
	}
	const facilities = parseFacilities(value.facilities);
	if (isErr(facilities)) {
		return facilities;
	}
	return Ok({ version: expectedVersion, tiles: tiles.value, facilities: facilities.value });
};
