import {
	TILE_BUDGET,
	TILE_EVICTION_EVERY_N_PUTS,
	TILE_HOSTS,
	TILE_LIFETIME_FLOOR_MS,
	TILE_MAX_AGE_MS,
	TILE_TOUCH_INTERVAL_MS,
} from '../src/core/config';
import type { CacheHeaders, Timestamp } from '../src/domain';
import { timestamp } from '../src/domain';
import type {
	ExtendableContext,
	FetchContext,
	OfflineConfig,
	OfflinePorts,
	OfflineRuntime,
	ServiceWorkerHost,
} from '../src/app/offline';
import { createOfflineRuntime, installServiceWorker, networkTileFetch } from '../src/app/offline';
import type { MemoryShellStore, ShellManifest } from '../src/features/shell';
import { memoryShellStore, parseShellManifest } from '../src/features/shell';
import type { Connectivity, TileBudget, TileStore } from '../src/features/tiles';
import { indexedDbTileStore } from '../src/features/tiles';

export type TileReply =
	| {
			readonly status?: number;
			readonly bytes?: ArrayBuffer;
			readonly headers?: Partial<CacheHeaders>;
	  }
	| 'network-error'
	| 'opaque';

export type OfflineWorker = {
	readonly install: () => Promise<void>;
	readonly activate: () => Promise<void>;
	readonly request: (
		input: string | Request,
		init?: { readonly mode?: string }
	) => Promise<Response | null>;
	readonly settle: () => Promise<void>;
	readonly tileFetches: readonly string[];
	readonly tileFetchCacheModes: readonly (string | undefined)[];
	readonly shellFetches: readonly string[];
	readonly tiles: TileStore;
	readonly shell: MemoryShellStore;
	readonly clock: {
		readonly now: () => Timestamp;
		readonly advance: (ms: number) => void;
		readonly set: (ms: number) => void;
	};
	readonly goOffline: () => void;
	readonly goOnline: () => void;
	readonly replyToTiles: (handler: (url: URL) => TileReply | Promise<TileReply>) => void;
	readonly replyToShell: (
		handler: (url: URL) => Response | Promise<Response> | 'network-error'
	) => void;
};

export type StartWorkerOptions = {
	readonly budget?: TileBudget;
	readonly shell?: ShellManifest | null;
	readonly evictionEveryNPuts?: number;
};

export const OSM_HEADERS: CacheHeaders = {
	cacheControl: 'max-age=72861, stale-while-revalidate=604800, stale-if-error=604800',
	expires: null,
};

export const tileUrl = (z: number, x: number, y: number): string =>
	`https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

export const pngBytes = (fill: number, size = 8192): ArrayBuffer => {
	const buffer = new ArrayBuffer(size);
	new Uint8Array(buffer).fill(fill);
	return buffer;
};

const FAKE_ORIGIN = 'https://gribudzert.test';

const START_TIME_MS = Date.parse('2026-09-07T10:00:00Z');

const DEFAULT_SHELL_MANIFEST_INPUT = {
	buildId: 'abcdef0123456789',
	assets: ['/index.html', '/assets/index-abc.js', '/assets/index-abc.css', '/manifest.json'],
};

const defaultShellManifest = (): ShellManifest => {
	const manifest = parseShellManifest(DEFAULT_SHELL_MANIFEST_INPUT);
	if (manifest === null) {
		throw new Error('Default shell manifest failed to parse');
	}
	return manifest;
};

const cacheHeadersFor = (reply: Exclude<TileReply, 'network-error' | 'opaque'>): CacheHeaders =>
	reply.headers === undefined
		? OSM_HEADERS
		: {
				cacheControl: reply.headers.cacheControl ?? null,
				expires: reply.headers.expires ?? null,
			};

const buildTileHeadersInit = (headers: CacheHeaders): Record<string, string> => {
	const entries: Record<string, string> = { 'content-type': 'image/png' };
	if (headers.cacheControl !== null) {
		entries['cache-control'] = headers.cacheControl;
	}
	if (headers.expires !== null) {
		entries.expires = headers.expires;
	}
	return entries;
};

const responseForTileReply = (reply: TileReply): Response => {
	if (reply === 'network-error') {
		throw new TypeError('Failed to fetch');
	}
	if (reply === 'opaque') {
		return { type: 'opaque', ok: false, status: 0 } as unknown as Response;
	}
	const status = reply.status ?? 200;
	const bytes = reply.bytes ?? pngBytes(0, 8192);
	return new Response(bytes, { status, headers: buildTileHeadersInit(cacheHeadersFor(reply)) });
};

const defaultShellHandler = (url: URL): Response =>
	new Response(`network:${url.pathname}`, {
		status: 200,
		headers: { 'content-type': 'text/html' },
	});

const INDEXED_DB_DRAIN_TURNS = 5;

const drainMacrotasks = async (): Promise<void> => {
	for (let turn = 0; turn < INDEXED_DB_DRAIN_TURNS; turn += 1) {
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
	}
};

export const startWorker = (options: StartWorkerOptions = {}): OfflineWorker => {
	let currentMs = START_TIME_MS;
	let connectivity: Connectivity = 'online';

	const tileFetches: string[] = [];
	const tileFetchCacheModes: (string | undefined)[] = [];
	const shellFetches: string[] = [];
	const pendingWaitUntils: Promise<unknown>[] = [];

	let tileHandler: (url: URL) => TileReply | Promise<TileReply> = () => ({});
	let shellHandler: (url: URL) => Response | Promise<Response> | 'network-error' =
		defaultShellHandler;

	const now = (): Timestamp => {
		const value = timestamp(currentMs);
		if (value === null) {
			throw new Error('Clock produced an invalid timestamp');
		}
		return value;
	};

	const fakeTileFetch = async (input: RequestInfo | URL): Promise<Response> => {
		const request = input as Request;
		const url = new URL(request.url);
		tileFetches.push(url.href);
		tileFetchCacheModes.push(request.cache);
		const reply = await tileHandler(url);
		return responseForTileReply(reply);
	};

	const fetchShell = async (request: Request): Promise<Response> => {
		shellFetches.push(request.url);
		const result = await shellHandler(new URL(request.url));
		if (result === 'network-error') {
			throw new TypeError('Failed to fetch');
		}
		return result;
	};

	const tiles = indexedDbTileStore();
	const shell = memoryShellStore();

	const ports: OfflinePorts = {
		now,
		connectivity: () => connectivity,
		fetchTile: networkTileFetch(fakeTileFetch),
		fetchShell,
		tiles,
		shell,
	};

	const config: OfflineConfig = {
		tileHosts: TILE_HOSTS,
		shellOrigin: FAKE_ORIGIN,
		shell: options.shell !== undefined ? options.shell : defaultShellManifest(),
		lifetime: { floorMs: TILE_LIFETIME_FLOOR_MS, maxAgeMs: TILE_MAX_AGE_MS },
		budget: options.budget ?? TILE_BUDGET,
		touchIntervalMs: TILE_TOUCH_INTERVAL_MS,
		evictionEveryNPuts: options.evictionEveryNPuts ?? TILE_EVICTION_EVERY_N_PUTS,
	};

	const runtime: OfflineRuntime = createOfflineRuntime(ports, config);

	let installListener: ((event: ExtendableContext) => void) | null = null;
	let activateListener: ((event: ExtendableContext) => void) | null = null;
	let fetchListener: ((event: FetchContext) => void) | null = null;

	const addEventListener = (
		type: 'install' | 'activate' | 'fetch',
		listener: ((event: ExtendableContext) => void) | ((event: FetchContext) => void)
	): void => {
		if (type === 'install') {
			installListener = listener as (event: ExtendableContext) => void;
		} else if (type === 'activate') {
			activateListener = listener as (event: ExtendableContext) => void;
		} else {
			fetchListener = listener as (event: FetchContext) => void;
		}
	};

	const host: ServiceWorkerHost = {
		addEventListener: addEventListener as ServiceWorkerHost['addEventListener'],
		clients: {
			claim: async () => undefined,
		},
		location: { origin: FAKE_ORIGIN },
	};

	installServiceWorker(host, runtime);

	const settle = async (): Promise<void> => {
		let previousLength = -1;
		while (previousLength !== pendingWaitUntils.length) {
			previousLength = pendingWaitUntils.length;
			await Promise.all(pendingWaitUntils.slice());
			await drainMacrotasks();
		}
	};

	const dispatchExtendable = async (
		listener: ((event: ExtendableContext) => void) | null
	): Promise<void> => {
		if (listener === null) {
			return;
		}
		listener({
			waitUntil: (task) => {
				pendingWaitUntils.push(task);
			},
		});
		await settle();
	};

	const buildRequest = (url: string, mode: string | undefined): Request => {
		const request = new Request(url, { method: 'GET' });
		if (mode !== undefined) {
			Object.defineProperty(request, 'mode', { value: mode, configurable: true });
		}
		return request;
	};

	const dispatchFetch = (request: Request): Promise<Response | null> =>
		new Promise<Response | null>((resolve) => {
			let responded = false;
			const context: FetchContext = {
				request,
				waitUntil: (task) => {
					pendingWaitUntils.push(task);
				},
				respondWith: (response) => {
					responded = true;
					Promise.resolve(response).then(resolve);
				},
			};
			fetchListener?.(context);
			if (!responded) {
				resolve(null);
			}
		});

	return {
		install: () => dispatchExtendable(installListener),
		activate: () => dispatchExtendable(activateListener),
		request: async (input, init) => {
			const httpRequest = typeof input === 'string' ? buildRequest(input, init?.mode) : input;
			return dispatchFetch(httpRequest);
		},
		settle,
		tileFetches,
		tileFetchCacheModes,
		shellFetches,
		tiles,
		shell,
		clock: {
			now,
			advance: (ms) => {
				currentMs += ms;
			},
			set: (ms) => {
				currentMs = ms;
			},
		},
		goOffline: () => {
			connectivity = 'offline';
		},
		goOnline: () => {
			connectivity = 'online';
		},
		replyToTiles: (handler) => {
			tileHandler = handler;
		},
		replyToShell: (handler) => {
			shellHandler = handler;
		},
	};
};
