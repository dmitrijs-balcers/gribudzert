import type { TileStatus, Timestamp } from '../../domain';

export type DataProvenance = 'live' | 'saved' | 'updating' | 'failed';

export const provenanceOf = (
	statuses: readonly TileStatus[],
	sessionStartedAt: Timestamp
): DataProvenance => {
	if (statuses.some((status) => status.kind === 'loading')) {
		return 'updating';
	}
	if (statuses.some((status) => status.kind === 'failed')) {
		return 'failed';
	}
	const allLiveThisSession = statuses.every(
		(status) => status.kind === 'fresh' && status.at >= sessionStartedAt
	);
	return allLiveThisSession ? 'live' : 'saved';
};
