import type { MapTileKey, Timestamp } from '../../domain';
import type { StoredTileMeta } from './record';

export type TileBudget = { readonly maxTiles: number; readonly maxBytes: number };

export type EvictionPlan = {
	readonly keep: readonly MapTileKey[];
	readonly drop: readonly MapTileKey[];
};

const compareKey = (a: MapTileKey, b: MapTileKey): number => (a < b ? -1 : a > b ? 1 : 0);

export const evictionPlan = (
	entries: readonly StoredTileMeta[],
	budget: TileBudget,
	now: Timestamp
): EvictionPlan => {
	const expired = entries.filter((entry) => entry.lifetime.usableUntil < now);
	const expiredKeys = new Set(expired.map((entry) => entry.key));
	const remaining = entries.filter((entry) => !expiredKeys.has(entry.key));

	const lruFirst = [...remaining].sort((a, b) => {
		if (a.lastUsedAt !== b.lastUsedAt) {
			return a.lastUsedAt - b.lastUsedAt;
		}
		return compareKey(a.key, b.key);
	});

	const drop: MapTileKey[] = expired.map((entry) => entry.key);
	const keep: MapTileKey[] = [];

	let count = lruFirst.length;
	let bytes = lruFirst.reduce((sum, entry) => sum + entry.size, 0);

	for (const entry of lruFirst) {
		if (count > budget.maxTiles || bytes > budget.maxBytes) {
			drop.push(entry.key);
			count -= 1;
			bytes -= entry.size;
		} else {
			keep.push(entry.key);
		}
	}

	return { keep, drop };
};
