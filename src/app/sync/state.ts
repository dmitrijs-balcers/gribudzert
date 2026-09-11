import type {
	Connectivity,
	Coverage,
	FacilityKind,
	LatLon,
	RequestId,
	RequestSequence,
	TileId,
	Timestamp,
	Viewport,
} from '../../domain';
import { emptyCoverage, initialRequestSequence } from '../../domain';
import type { Snapshot } from '../../features/cache/snapshot';
import { emptySnapshot } from '../../features/cache/snapshot';
import type { LayerKind } from '../layers';

export type PendingFetch = {
	readonly id: RequestId;
	readonly tiles: readonly TileId[];
	readonly kinds: readonly FacilityKind[];
	readonly loadingShown: boolean;
};

export type SyncState = {
	readonly snapshot: Snapshot;
	readonly coverage: Coverage;
	readonly pending: PendingFetch | null;
	readonly nextRequest: RequestSequence;
	readonly viewport: Viewport | null;
	readonly layers: Readonly<Record<LayerKind, boolean>>;
	readonly userOrigin: LatLon | null;
	readonly zoomedOutNoticeShown: boolean;
	readonly emptyAreaNotifiedAt: Readonly<Record<LayerKind, Timestamp | null>>;
	readonly sessionStartedAt: Timestamp;
	readonly connectivity: Connectivity;
};

export const initialSyncState = (
	sessionStartedAt: Timestamp,
	snapshot: Snapshot = emptySnapshot(),
	connectivity: Connectivity = 'online'
): SyncState => ({
	snapshot,
	coverage: emptyCoverage,
	pending: null,
	nextRequest: initialRequestSequence,
	viewport: null,
	layers: { water: true, toilet: false, viewpoint: false },
	userOrigin: null,
	zoomedOutNoticeShown: false,
	emptyAreaNotifiedAt: { water: null, toilet: null, viewpoint: null },
	sessionStartedAt,
	connectivity,
});
