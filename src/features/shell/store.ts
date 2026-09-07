import { SHELL_CACHE_PREFIX } from '../../core/config';
import type { BuildId, ShellAssetPath } from './manifest';

export type ShellStore = {
	readonly precache: (build: BuildId, assets: readonly ShellAssetPath[]) => Promise<void>;
	readonly match: (build: BuildId, path: ShellAssetPath) => Promise<Response | null>;
	readonly dropOtherBuilds: (keep: BuildId) => Promise<void>;
};

export type MemoryShellStore = ShellStore & {
	readonly seed: (build: BuildId, path: ShellAssetPath, response: Response) => void;
	readonly builds: () => readonly string[];
};

const cacheNameFor = (prefix: string, build: BuildId): string => `${prefix}${build}`;

export const cacheApiShellStore = (
	storage: CacheStorage,
	prefix: string = SHELL_CACHE_PREFIX
): ShellStore => ({
	precache: async (build, assets) => {
		const cache = await storage.open(cacheNameFor(prefix, build));
		await cache.addAll(assets);
	},
	match: async (build, path) => {
		const cache = await storage.open(cacheNameFor(prefix, build));
		return (await cache.match(path))?.clone() ?? null;
	},
	dropOtherBuilds: async (keep) => {
		const keptName = cacheNameFor(prefix, keep);
		const names = await storage.keys();
		await Promise.all(
			names
				.filter((name) => name.startsWith(prefix) && name !== keptName)
				.map((name) => storage.delete(name))
		);
	},
});

export const memoryShellStore = (): MemoryShellStore => {
	const caches = new Map<string, Map<ShellAssetPath, Response>>();

	const cacheFor = (build: BuildId): Map<ShellAssetPath, Response> => {
		const existing = caches.get(build);
		if (existing !== undefined) {
			return existing;
		}
		const created = new Map<ShellAssetPath, Response>();
		caches.set(build, created);
		return created;
	};

	return {
		precache: async (build, assets) => {
			const cache = cacheFor(build);
			for (const asset of assets) {
				if (!cache.has(asset)) {
					cache.set(asset, new Response('', { status: 200 }));
				}
			}
		},
		match: async (build, path) => {
			const response = caches.get(build)?.get(path);
			return response === undefined ? null : response.clone();
		},
		dropOtherBuilds: async (keep) => {
			for (const name of [...caches.keys()]) {
				if (name !== keep) {
					caches.delete(name);
				}
			}
		},
		seed: (build, path, response) => {
			cacheFor(build).set(path, response);
		},
		builds: () => [...caches.keys()],
	};
};
