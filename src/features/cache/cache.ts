/**
 * Facility cache aggregate
 * Holds the in-memory `Snapshot` the rest of the app reads from, loads it from a
 * `SnapshotStore` once at startup, and persists every update. Reads are always synchronous
 * against whatever is currently in memory (empty until `ready` resolves); writes never
 * overlap on the store.
 */

import { FACILITY_CACHE_MAX_TILES, FACILITY_CACHE_TTL_MS } from '../../core/config';
import type { Facility, FacilityKind, TileId } from '../../domain';
import * as logger from '../../utils/logger';
import type { Lookup, Snapshot } from './snapshot';
import { emptySnapshot, evict, lookup, mergeSnapshots, reconcile } from './snapshot';
import type { SnapshotStore } from './storage';

/**
 * Tuning knobs for a `FacilityCache`, defaulting to the values in `core/config`
 */
export type FacilityCacheOptions = {
	readonly ttlMs?: number;
	readonly maxTiles?: number;
};

/**
 * The offline facility cache as the rest of the app sees it: a synchronous read against the
 * in-memory snapshot, and a fire-and-forget write that reconciles, evicts, and persists.
 */
export type FacilityCache = {
	/** Resolves once the persisted snapshot has been loaded (or given up on) */
	readonly ready: Promise<void>;
	readonly lookup: (
		tiles: readonly TileId[],
		kinds: readonly FacilityKind[],
		now: number
	) => Lookup;
	/** Reconcile + evict in memory, then persist (fire-and-forget, serialised against other saves) */
	readonly absorb: (
		tiles: readonly TileId[],
		kinds: readonly FacilityKind[],
		facilities: readonly Facility[],
		now: number
	) => void;
};

/**
 * Create a `FacilityCache` backed by `store`. Starts from an empty snapshot and swaps in the
 * persisted one as soon as it loads, so a slow or failed load never blocks `lookup`/`absorb`
 * - it just means those calls start out seeing nothing cached, same as a first visit.
 *
 * Bootstrap only waits a bounded amount of time for `ready`, so an `absorb` can legitimately
 * happen before the load finishes. When that happens, the loaded snapshot is merged under
 * the in-memory one (whose tiles win) instead of replacing it outright, so the absorbed data
 * is never lost; the merge result is persisted so the next load sees it too.
 */
export const createFacilityCache = (
	store: SnapshotStore,
	options: FacilityCacheOptions = {}
): FacilityCache => {
	const ttlMs = options.ttlMs ?? FACILITY_CACHE_TTL_MS;
	const maxTiles = options.maxTiles ?? FACILITY_CACHE_MAX_TILES;

	let snapshot: Snapshot = emptySnapshot();
	let absorbedBeforeReady = false;
	let saveChain: Promise<void> = Promise.resolve();

	const persist = (): void => {
		const toSave = snapshot;
		saveChain = saveChain
			.then(() => store.save(toSave))
			.catch((error: unknown) => {
				logger.error('Facility cache persist failed', error);
			});
	};

	const ready = store.load().then((loaded) => {
		if (loaded === null) {
			return;
		}
		if (absorbedBeforeReady) {
			snapshot = mergeSnapshots(loaded, snapshot);
			persist();
		} else {
			snapshot = loaded;
		}
	});

	return {
		ready,
		lookup: (tiles, kinds, now) => lookup(snapshot, tiles, kinds, now, ttlMs),
		absorb: (tiles, kinds, facilities, now) => {
			absorbedBeforeReady = true;
			snapshot = evict(reconcile(snapshot, tiles, kinds, facilities, now), maxTiles);
			persist();
		},
	};
};
