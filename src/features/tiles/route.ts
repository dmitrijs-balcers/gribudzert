import type { MapTileKey } from '../../domain';
import { mapTileKey } from '../../domain';
import type { ShellAssetPath } from '../shell/manifest';

export type RequestFacts = { readonly method: string; readonly mode: string; readonly url: URL };

export type RouteConfig = {
	readonly tileHosts: readonly string[];
	readonly shellOrigin: string;
	readonly shellAssets: ReadonlySet<ShellAssetPath>;
};

export type Route =
	| { readonly kind: 'map-tile'; readonly key: MapTileKey }
	| { readonly kind: 'navigation' }
	| { readonly kind: 'shell-asset'; readonly path: ShellAssetPath }
	| { readonly kind: 'passthrough' };

const TILE_PATH_PATTERN = /^\/(\d+)\/(\d+)\/(\d+)\.png$/;

const mapTileRoute = (url: URL, tileHosts: readonly string[]): Route | null => {
	if (!tileHosts.includes(url.hostname)) {
		return null;
	}
	const match = TILE_PATH_PATTERN.exec(url.pathname);
	if (match === null) {
		return null;
	}
	const [, rawZ, rawX, rawY] = match;
	if (rawZ === undefined || rawX === undefined || rawY === undefined) {
		return null;
	}
	const key = mapTileKey(Number(rawZ), Number(rawX), Number(rawY));
	if (key === null) {
		return null;
	}
	return { kind: 'map-tile', key };
};

export const route = (facts: RequestFacts, config: RouteConfig): Route => {
	if (facts.method !== 'GET') {
		return { kind: 'passthrough' };
	}

	const tileRoute = mapTileRoute(facts.url, config.tileHosts);
	if (tileRoute !== null) {
		return tileRoute;
	}

	if (facts.url.origin !== config.shellOrigin) {
		return { kind: 'passthrough' };
	}

	if (facts.mode === 'navigate') {
		return { kind: 'navigation' };
	}

	const path = facts.url.pathname as ShellAssetPath;
	if (config.shellAssets.has(path)) {
		return { kind: 'shell-asset', path };
	}

	return { kind: 'passthrough' };
};
