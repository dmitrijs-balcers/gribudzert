/**
 * Cache feature public API
 * The offline facility cache: a tile-keyed snapshot, its IndexedDB storage boundary, and the
 * aggregate that ties reads and writes together.
 */

export type { FacilityCache, FacilityCacheOptions } from './cache';
export { createFacilityCache } from './cache';
export type {
	CachedFacility,
	Lookup,
	Snapshot,
	TileCoverage,
	TileStatus,
	Timestamp,
} from './snapshot';
export {
	emptySnapshot,
	evict,
	lookup,
	mergeSnapshots,
	parseSnapshot,
	reconcile,
	tileStatus,
} from './snapshot';
export type { SnapshotStore } from './storage';
export { defaultSnapshotStore, indexedDbSnapshotStore, memorySnapshotStore } from './storage';
