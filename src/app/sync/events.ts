import type { Connectivity, Facility, LatLon, RequestId, TileId, Viewport } from '../../domain';
import type { Snapshot } from '../../features/cache/snapshot';
import type { LayerKind, UserFacingFetchError } from '../layers';

export type SyncEvent =
	| { readonly kind: 'viewport-settled'; readonly viewport: Viewport }
	| { readonly kind: 'cache-ready'; readonly snapshot: Snapshot }
	| { readonly kind: 'layer-toggled'; readonly layer: LayerKind; readonly active: boolean }
	| { readonly kind: 'origin-moved'; readonly position: LatLon }
	| { readonly kind: 'connectivity-changed'; readonly connectivity: Connectivity }
	| {
			readonly kind: 'fetch-succeeded';
			readonly request: RequestId;
			readonly tiles: readonly TileId[];
			readonly kinds: readonly LayerKind[];
			readonly facilities: readonly Facility[];
	  }
	| {
			readonly kind: 'fetch-failed';
			readonly request: RequestId;
			readonly error: UserFacingFetchError;
	  };
