import { FACILITY_CACHE_MAX_TILES, FACILITY_CACHE_TTL_MS } from '../../core/config';
import type { DurationMs, Facility, FacilityKind, TileId, Timestamp } from '../../domain';
import * as logger from '../../utils/logger';
import type { Lookup, Snapshot } from './snapshot';
import { emptySnapshot, evict, lookup, mergeSnapshots, reconcile } from './snapshot';
import type { SnapshotStore } from './storage';

export type FacilityCacheOptions = {
	readonly ttlMs?: DurationMs;
	readonly maxTiles?: number;
};

export type FacilityCache = {
	readonly ready: Promise<void>;
	readonly lookup: (
		tiles: readonly TileId[],
		kinds: readonly FacilityKind[],
		now: Timestamp
	) => Lookup;
	readonly absorb: (
		tiles: readonly TileId[],
		kinds: readonly FacilityKind[],
		facilities: readonly Facility[],
		now: Timestamp
	) => void;
};

type CacheState =
	| { readonly phase: 'warming'; readonly absorbed: Snapshot | null }
	| { readonly phase: 'ready'; readonly snapshot: Snapshot };

export const createFacilityCache = (
	store: SnapshotStore,
	options: FacilityCacheOptions = {}
): FacilityCache => {
	const ttlMs = options.ttlMs ?? FACILITY_CACHE_TTL_MS;
	const maxTiles = options.maxTiles ?? FACILITY_CACHE_MAX_TILES;

	let state: CacheState = { phase: 'warming', absorbed: null };
	let saveChain: Promise<void> = Promise.resolve();

	const persist = (toSave: Snapshot): void => {
		saveChain = saveChain
			.then(() => store.save(toSave))
			.catch((error: unknown) => {
				logger.error('Facility cache persist failed', error);
			});
	};

	const currentSnapshot = (): Snapshot => {
		switch (state.phase) {
			case 'warming':
				return state.absorbed ?? emptySnapshot();
			case 'ready':
				return state.snapshot;
			default: {
				const exhaustive: never = state;
				throw new Error(`Unhandled cache state: ${JSON.stringify(exhaustive)}`);
			}
		}
	};

	const ready = store.load().then((loaded) => {
		switch (loaded.kind) {
			case 'present': {
				if (state.phase === 'warming' && state.absorbed !== null) {
					const merged = mergeSnapshots(loaded.snapshot, state.absorbed);
					state = { phase: 'ready', snapshot: merged };
					persist(merged);
				} else {
					state = { phase: 'ready', snapshot: loaded.snapshot };
				}
				return;
			}
			case 'absent':
			case 'corrupt':
			case 'unavailable': {
				state = { phase: 'ready', snapshot: currentSnapshot() };
				return;
			}
			default: {
				const exhaustive: never = loaded;
				throw new Error(`Unhandled snapshot load outcome: ${JSON.stringify(exhaustive)}`);
			}
		}
	});

	return {
		ready,
		lookup: (tiles, kinds, now) => lookup(currentSnapshot(), tiles, kinds, now, ttlMs),
		absorb: (tiles, kinds, facilities, now) => {
			const updated = evict(reconcile(currentSnapshot(), tiles, kinds, facilities, now), maxTiles);
			switch (state.phase) {
				case 'warming':
					state = { phase: 'warming', absorbed: updated };
					break;
				case 'ready':
					state = { phase: 'ready', snapshot: updated };
					break;
				default: {
					const exhaustive: never = state;
					throw new Error(`Unhandled cache state: ${JSON.stringify(exhaustive)}`);
				}
			}
			persist(updated);
		},
	};
};
