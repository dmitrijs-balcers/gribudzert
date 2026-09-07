import { createOfflineRuntime, installServiceWorker } from './app/offline';
import type { OfflineConfig, OfflinePorts, ServiceWorkerHost } from './app/offline';
import { networkTileFetch } from './app/offline';
import {
	SHELL_CACHE_PREFIX,
	TILE_BUDGET,
	TILE_EVICTION_EVERY_N_PUTS,
	TILE_HOSTS,
	TILE_LIFETIME_FLOOR_MS,
	TILE_MAX_AGE_MS,
	TILE_TOUCH_INTERVAL_MS,
} from './core/config';
import { timestampNow } from './domain';
import type { ShellManifest } from './features/shell';
import { cacheApiShellStore, parseShellManifest } from './features/shell';
import { indexedDbTileStore } from './features/tiles';
import * as logger from './utils/logger';

declare const __SHELL_MANIFEST__: string;

const parseInjectedManifest = (): ShellManifest | null => {
	try {
		return parseShellManifest(JSON.parse(__SHELL_MANIFEST__));
	} catch (error) {
		logger.error('Shell manifest parse failed', error);
		return null;
	}
};

const config: OfflineConfig = {
	tileHosts: TILE_HOSTS,
	shellOrigin: self.location.origin,
	shell: parseInjectedManifest(),
	lifetime: { floorMs: TILE_LIFETIME_FLOOR_MS, maxAgeMs: TILE_MAX_AGE_MS },
	budget: TILE_BUDGET,
	touchIntervalMs: TILE_TOUCH_INTERVAL_MS,
	evictionEveryNPuts: TILE_EVICTION_EVERY_N_PUTS,
};

const ports: OfflinePorts = {
	now: timestampNow,
	connectivity: () => (navigator.onLine ? 'online' : 'offline'),
	fetchTile: networkTileFetch(fetch),
	fetchShell: (request) => fetch(request),
	tiles: indexedDbTileStore(),
	shell: cacheApiShellStore(caches, SHELL_CACHE_PREFIX),
};

installServiceWorker(self as unknown as ServiceWorkerHost, createOfflineRuntime(ports, config));
