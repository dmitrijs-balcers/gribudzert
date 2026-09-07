import type { CacheHeaders, DurationMs, LifetimeBounds, Timestamp } from '../../domain';
import type { ShellManifest, ShellStore } from '../../features/shell';
import type { Connectivity, TileBudget, TileStore } from '../../features/tiles';

export type TileFetchOutcome =
	| {
			readonly kind: 'ok';
			readonly bytes: ArrayBuffer;
			readonly contentType: string;
			readonly headers: CacheHeaders;
	  }
	| { readonly kind: 'opaque'; readonly response: Response }
	| { readonly kind: 'http-error'; readonly status: number }
	| { readonly kind: 'network-error' };

export type OfflinePorts = {
	readonly now: () => Timestamp;
	readonly connectivity: () => Connectivity;
	readonly fetchTile: (request: Request) => Promise<TileFetchOutcome>;
	readonly fetchShell: (request: Request) => Promise<Response>;
	readonly tiles: TileStore;
	readonly shell: ShellStore;
};

export type OfflineConfig = {
	readonly tileHosts: readonly string[];
	readonly shellOrigin: string;
	readonly shell: ShellManifest | null;
	readonly lifetime: LifetimeBounds;
	readonly budget: TileBudget;
	readonly touchIntervalMs: DurationMs;
	readonly evictionEveryNPuts: number;
};

export const networkTileFetch =
	(fetchFn: typeof fetch): OfflinePorts['fetchTile'] =>
	async (request) => {
		try {
			const response = await fetchFn(request);
			if (response.type === 'opaque') {
				return { kind: 'opaque', response };
			}
			if (!response.ok) {
				return { kind: 'http-error', status: response.status };
			}
			const bytes = await response.arrayBuffer();
			return {
				kind: 'ok',
				bytes,
				contentType: response.headers.get('content-type') ?? 'image/png',
				headers: {
					cacheControl: response.headers.get('cache-control'),
					expires: response.headers.get('expires'),
				},
			};
		} catch {
			return { kind: 'network-error' };
		}
	};
