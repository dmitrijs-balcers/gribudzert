import type { FacilityKind } from './facility';
import type { TileId } from './tile';
import type { DurationMs, Timestamp } from './units';

export type RequestId = string & { readonly __brand: 'RequestId' };

export type RequestSequence = number & { readonly __brand: 'RequestSequence' };

export const initialRequestSequence: RequestSequence = 0 as RequestSequence;

export const issueRequestId = (
	sequence: RequestSequence
): readonly [RequestId, RequestSequence] => {
	const next = (sequence + 1) as RequestSequence;
	return [`request-${next}` as RequestId, next];
};

export type TileStatus =
	| { readonly kind: 'missing' }
	| { readonly kind: 'fresh'; readonly at: Timestamp }
	| { readonly kind: 'stale'; readonly at: Timestamp }
	| { readonly kind: 'loading'; readonly request: RequestId }
	| { readonly kind: 'failed'; readonly retryAfter: Timestamp };

export type Coverage = Readonly<
	Record<TileId, Readonly<Partial<Record<FacilityKind, TileStatus>>>>
>;

export const emptyCoverage: Coverage = {};

const withTileStatus = (
	coverage: Coverage,
	tile: TileId,
	kind: FacilityKind,
	status: TileStatus | undefined
): Coverage => {
	const tileEntry = { ...coverage[tile] };
	if (status === undefined) {
		delete tileEntry[kind];
	} else {
		tileEntry[kind] = status;
	}
	return { ...coverage, [tile]: tileEntry };
};

export const markLoading = (
	coverage: Coverage,
	tile: TileId,
	kind: FacilityKind,
	request: RequestId
): Coverage => withTileStatus(coverage, tile, kind, { kind: 'loading', request });

export const markFailed = (
	coverage: Coverage,
	tile: TileId,
	kind: FacilityKind,
	retryAfter: Timestamp
): Coverage => withTileStatus(coverage, tile, kind, { kind: 'failed', retryAfter });

const clearStatus = (coverage: Coverage, tile: TileId, kind: FacilityKind): Coverage =>
	withTileStatus(coverage, tile, kind, undefined);

export const clearMany = (
	coverage: Coverage,
	tiles: readonly TileId[],
	kinds: readonly FacilityKind[]
): Coverage => {
	let next = coverage;
	for (const tile of tiles) {
		for (const kind of kinds) {
			next = clearStatus(next, tile, kind);
		}
	}
	return next;
};

const deriveStatus = (
	fetchedAt: Timestamp | undefined,
	now: Timestamp,
	ttlMs: DurationMs
): TileStatus => {
	if (fetchedAt === undefined) {
		return { kind: 'missing' };
	}
	return now - fetchedAt <= ttlMs
		? { kind: 'fresh', at: fetchedAt }
		: { kind: 'stale', at: fetchedAt };
};

export const statusOf = (
	coverage: Coverage,
	fetchedAt: Timestamp | undefined,
	tile: TileId,
	kind: FacilityKind,
	now: Timestamp,
	ttlMs: DurationMs
): TileStatus => coverage[tile]?.[kind] ?? deriveStatus(fetchedAt, now, ttlMs);

export const wantsFetch = (status: TileStatus, now: Timestamp): boolean => {
	switch (status.kind) {
		case 'missing':
		case 'stale':
			return true;
		case 'failed':
			return status.retryAfter <= now;
		case 'fresh':
		case 'loading':
			return false;
		default: {
			const exhaustive: never = status;
			return exhaustive;
		}
	}
};
