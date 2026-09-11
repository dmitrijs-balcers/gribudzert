import type { Facility, Located, NoticeRequest, RequestId, TileBounds, TileId } from '../../domain';
import type { Snapshot } from '../../features/cache/snapshot';
import type { LayerKind } from '../layers';
import type { DataProvenance } from './provenance';

export type LayerRender = {
	readonly kind: LayerKind;
	readonly items: readonly Located<Facility>[];
};

export type SyncEffect =
	| {
			readonly kind: 'start-fetch';
			readonly request: RequestId;
			readonly tiles: readonly TileId[];
			readonly kinds: readonly LayerKind[];
			readonly bounds: TileBounds;
	  }
	| { readonly kind: 'abort-fetch'; readonly request: RequestId }
	| { readonly kind: 'render'; readonly layers: readonly LayerRender[] }
	| { readonly kind: 'clear-render' }
	| { readonly kind: 'notify'; readonly request: NoticeRequest }
	| { readonly kind: 'clear-status' }
	| { readonly kind: 'persist'; readonly snapshot: Snapshot }
	| {
			readonly kind: 'report-nearest';
			readonly layer: LayerKind;
			readonly nearest: Located<Facility> | null;
	  }
	| { readonly kind: 'track-area-explored' }
	| { readonly kind: 'track-empty-area'; readonly layer: LayerKind }
	| { readonly kind: 'report-provenance'; readonly provenance: DataProvenance | null };
