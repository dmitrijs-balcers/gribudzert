import type { Zoom } from './units';
import { zoom } from './units';

export type MapTileKey = string & { readonly __brand: 'MapTileKey' };

const isNonNegativeInteger = (value: number): boolean => Number.isInteger(value) && value >= 0;

export const mapTileKey = (z: number, x: number, y: number): MapTileKey | null => {
	const parsedZoom = zoom(z);
	if (parsedZoom === null) {
		return null;
	}
	if (!isNonNegativeInteger(x) || !isNonNegativeInteger(y)) {
		return null;
	}
	const size = 2 ** parsedZoom;
	if (x >= size || y >= size) {
		return null;
	}
	return `${parsedZoom}/${x}/${y}` as MapTileKey;
};

const MAP_TILE_KEY_PATTERN = /^\d+\/\d+\/\d+$/;

export const parseMapTileKey = (
	value: string
): { readonly z: Zoom; readonly x: number; readonly y: number } | null => {
	if (!MAP_TILE_KEY_PATTERN.test(value)) {
		return null;
	}
	const [rawZ, rawX, rawY] = value.split('/');
	if (rawZ === undefined || rawX === undefined || rawY === undefined) {
		return null;
	}
	const z = Number(rawZ);
	const x = Number(rawX);
	const y = Number(rawY);
	if (mapTileKey(z, x, y) === null) {
		return null;
	}
	const parsedZoom = zoom(z);
	if (parsedZoom === null) {
		return null;
	}
	return { z: parsedZoom, x, y };
};
