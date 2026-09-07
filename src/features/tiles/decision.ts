import type { Timestamp } from '../../domain';
import { freshnessAt } from '../../domain';
import type { StoredTile } from './record';

export type Connectivity = 'online' | 'offline';

export type TileDecision =
	| { readonly kind: 'serve'; readonly tile: StoredTile }
	| { readonly kind: 'serve-then-revalidate'; readonly tile: StoredTile }
	| { readonly kind: 'fetch-then-fallback'; readonly fallback: StoredTile }
	| { readonly kind: 'fetch' };

export const decide = (
	stored: StoredTile | null,
	now: Timestamp,
	connectivity: Connectivity
): TileDecision => {
	if (stored === null) {
		return { kind: 'fetch' };
	}

	if (connectivity === 'offline') {
		return { kind: 'serve', tile: stored };
	}

	const freshness = freshnessAt(stored.lifetime, now);
	switch (freshness) {
		case 'fresh':
			return { kind: 'serve', tile: stored };
		case 'stale':
			return { kind: 'serve-then-revalidate', tile: stored };
		case 'expired':
			return { kind: 'fetch-then-fallback', fallback: stored };
		default: {
			const exhaustive: never = freshness;
			throw new Error(`Unhandled freshness: ${JSON.stringify(exhaustive)}`);
		}
	}
};
