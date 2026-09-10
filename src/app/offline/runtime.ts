import type { MapTileKey } from '../../domain';
import { lifetimeFrom } from '../../domain';
import type { BuildId, ShellAssetPath } from '../../features/shell';
import { SHELL_ENTRY } from '../../features/shell';
import type { RouteConfig, StoredTile } from '../../features/tiles';
import { decide, evictionPlan, route } from '../../features/tiles';
import type { FetchContext } from './host';
import type { OfflineConfig, OfflinePorts, TileFetchOutcome } from './ports';

export type OfflineRuntime = {
	readonly install: () => Promise<void>;
	readonly activate: () => Promise<void>;
	readonly fetch: (
		context: Pick<FetchContext, 'request' | 'waitUntil'>
	) => Promise<Response> | null;
};

type TileFetchContext = Pick<FetchContext, 'request' | 'waitUntil'>;

const tileResponse = (tile: StoredTile, source: 'cache' | 'network'): Response =>
	new Response(tile.bytes, {
		status: 200,
		headers: { 'Content-Type': tile.contentType, 'X-Gribudzert-Tile-Source': source },
	});

export const createOfflineRuntime = (
	ports: OfflinePorts,
	config: OfflineConfig
): OfflineRuntime => {
	const routeConfig: RouteConfig = {
		tileHosts: config.tileHosts,
		shellOrigin: config.shellOrigin,
		shellAssets: new Set(config.shell?.assets ?? []),
	};

	const inFlight = new Map<MapTileKey, Promise<TileFetchOutcome>>();
	let putCount = 0;
	let enforcingBudget: Promise<void> | null = null;

	const fetchOnce = (key: MapTileKey, request: Request): Promise<TileFetchOutcome> => {
		const existing = inFlight.get(key);
		if (existing !== undefined) {
			return existing;
		}
		const outcome = ports.fetchTile(request).finally(() => {
			inFlight.delete(key);
		});
		inFlight.set(key, outcome);
		return outcome;
	};

	const enforceBudget = (): Promise<void> => {
		if (enforcingBudget !== null) {
			return enforcingBudget;
		}
		const run = (async () => {
			try {
				const meta = await ports.tiles.meta();
				const plan = evictionPlan(meta, config.budget, ports.now());
				if (plan.drop.length > 0) {
					await ports.tiles.drop(plan.drop);
				}
			} finally {
				enforcingBudget = null;
			}
		})();
		enforcingBudget = run;
		return run;
	};

	const tileFrom = (
		key: MapTileKey,
		outcome: Extract<TileFetchOutcome, { kind: 'ok' }>
	): StoredTile => {
		const now = ports.now();
		return {
			key,
			contentType: outcome.contentType,
			size: outcome.bytes.byteLength,
			storedAt: now,
			lastUsedAt: now,
			lifetime: lifetimeFrom(outcome.headers, now, config.lifetime),
			bytes: outcome.bytes,
		};
	};

	const store = async (tile: StoredTile): Promise<void> => {
		await ports.tiles.put(tile);
		putCount += 1;
		if (putCount % config.evictionEveryNPuts === 0) {
			await enforceBudget();
		}
	};

	const revalidate = async (key: MapTileKey, request: Request): Promise<void> => {
		const outcome = await fetchOnce(key, request);
		if (outcome.kind === 'ok') {
			await store(tileFrom(key, outcome));
		}
	};

	const respondToFetchOutcome = (
		key: MapTileKey,
		outcome: TileFetchOutcome,
		context: TileFetchContext,
		onMiss: () => Response
	): Response => {
		switch (outcome.kind) {
			case 'ok': {
				const tile = tileFrom(key, outcome);
				context.waitUntil(store(tile));
				return tileResponse(tile, 'network');
			}
			case 'opaque':
				return outcome.response;
			case 'http-error':
			case 'network-error':
				return onMiss();
			default: {
				const exhaustive: never = outcome;
				throw new Error(`Unhandled tile fetch outcome: ${JSON.stringify(exhaustive)}`);
			}
		}
	};

	const handleTile = async (key: MapTileKey, context: TileFetchContext): Promise<Response> => {
		const stored = await ports.tiles.get(key);
		const now = ports.now();
		const decision = decide(stored, now, ports.connectivity());

		const touchIfNeeded = (tile: StoredTile): void => {
			if (now - tile.lastUsedAt >= config.touchIntervalMs) {
				context.waitUntil(ports.tiles.touch(key, now));
			}
		};

		switch (decision.kind) {
			case 'serve':
				touchIfNeeded(decision.tile);
				return tileResponse(decision.tile, 'cache');
			case 'serve-then-revalidate':
				touchIfNeeded(decision.tile);
				context.waitUntil(revalidate(key, context.request));
				return tileResponse(decision.tile, 'cache');
			case 'fetch-then-fallback': {
				const outcome = await fetchOnce(key, context.request);
				return respondToFetchOutcome(key, outcome, context, () =>
					tileResponse(decision.fallback, 'cache')
				);
			}
			case 'fetch': {
				const outcome = await fetchOnce(key, context.request);
				return respondToFetchOutcome(key, outcome, context, () => {
					if (outcome.kind === 'http-error') {
						return new Response(null, { status: outcome.status });
					}
					return new Response(null, { status: 504 });
				});
			}
			default: {
				const exhaustive: never = decision;
				throw new Error(`Unhandled tile decision: ${JSON.stringify(exhaustive)}`);
			}
		}
	};

	const install = async (): Promise<void> => {
		if (config.shell === null) {
			return;
		}
		await ports.shell.precache(config.shell.buildId, config.shell.assets);
	};

	const activate = async (): Promise<void> => {
		if (config.shell !== null) {
			await ports.shell.dropOtherBuilds(config.shell.buildId);
		}
		await enforceBudget();
	};

	// Cache-first for the whole shell: a slow-but-alive connection never rejects a
	// network-first fetch, so the user would wait on it with the app already on the device.
	const shellCacheFirst = async (
		build: BuildId,
		path: ShellAssetPath,
		request: Request
	): Promise<Response> => (await ports.shell.match(build, path)) ?? ports.fetchShell(request);

	const fetch = (context: TileFetchContext): Promise<Response> | null => {
		const request = context.request;
		const matchedRoute = route(
			{ method: request.method, mode: request.mode, url: new URL(request.url) },
			routeConfig
		);

		switch (matchedRoute.kind) {
			case 'passthrough':
				return null;
			case 'navigation': {
				const shell = config.shell;
				if (shell === null) {
					return null;
				}
				return shellCacheFirst(shell.buildId, SHELL_ENTRY, request).catch(
					() => new Response(null, { status: 503 })
				);
			}
			case 'shell-asset': {
				const shell = config.shell;
				if (shell === null) {
					return null;
				}
				return shellCacheFirst(shell.buildId, matchedRoute.path, request);
			}
			case 'map-tile':
				return handleTile(matchedRoute.key, context);
			default: {
				const exhaustive: never = matchedRoute;
				throw new Error(`Unhandled route: ${JSON.stringify(exhaustive)}`);
			}
		}
	};

	return { install, activate, fetch };
};
