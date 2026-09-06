import { CACHE_TILE_ZOOM } from '../core/config';
import type { LatLon } from './geo';
import type { Zoom } from './units';
import { zoom } from './units';

export type TileId = string & { readonly __brand: 'TileId' };

export type TileBounds = {
	readonly south: number;
	readonly west: number;
	readonly north: number;
	readonly east: number;
};

const MERCATOR_MAX_LATITUDE = 85.0511;

const clampLatitudeToMercatorRange = (lat: number): number =>
	Math.min(MERCATOR_MAX_LATITUDE, Math.max(-MERCATOR_MAX_LATITUDE, lat));

const clampTileIndex = (value: number, atZoom: Zoom): number =>
	Math.min(2 ** atZoom - 1, Math.max(0, value));

const fractionalTileColumn = (lon: number, atZoom: Zoom): number =>
	((lon + 180) / 360) * 2 ** atZoom;

const fractionalTileRow = (lat: number, atZoom: Zoom): number => {
	const radians = (clampLatitudeToMercatorRange(lat) * Math.PI) / 180;
	const y = (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2;
	return y * 2 ** atZoom;
};

const columnContaining = (lon: number, atZoom: Zoom): number =>
	clampTileIndex(Math.floor(fractionalTileColumn(lon, atZoom)), atZoom);

const rowContaining = (lat: number, atZoom: Zoom): number =>
	clampTileIndex(Math.floor(fractionalTileRow(lat, atZoom)), atZoom);

const westEdgeLongitudeOfColumn = (x: number, atZoom: Zoom): number =>
	(x / 2 ** atZoom) * 360 - 180;

const northEdgeLatitudeOfRow = (y: number, atZoom: Zoom): number => {
	const n = Math.PI - (2 * Math.PI * y) / 2 ** atZoom;
	return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

const formatTileId = (atZoom: Zoom, x: number, y: number): TileId =>
	`${atZoom}/${x}/${y}` as TileId;

export const tileOf = (point: LatLon, atZoom: Zoom = CACHE_TILE_ZOOM): TileId =>
	formatTileId(atZoom, columnContaining(point.lon, atZoom), rowContaining(point.lat, atZoom));

export const parseTileId = (
	id: string
): { readonly zoom: Zoom; readonly x: number; readonly y: number } | null => {
	const match = /^(\d+)\/(\d+)\/(\d+)$/.exec(id);
	if (match === null) {
		return null;
	}
	const parsedZoom = zoom(Number(match[1]));
	if (parsedZoom === null) {
		return null;
	}
	const x = Number(match[2]);
	const y = Number(match[3]);
	const size = 2 ** parsedZoom;
	if (x >= size || y >= size) {
		return null;
	}
	return { zoom: parsedZoom, x, y };
};

const requirePartsOf = (
	id: TileId
): { readonly zoom: Zoom; readonly x: number; readonly y: number } => {
	const parsed = parseTileId(id);
	if (parsed === null) {
		throw new Error(`Invalid TileId: ${id}`);
	}
	return parsed;
};

export const tileBounds = (id: TileId): TileBounds => {
	const { zoom: atZoom, x, y } = requirePartsOf(id);
	return {
		south: northEdgeLatitudeOfRow(y + 1, atZoom),
		west: westEdgeLongitudeOfColumn(x, atZoom),
		north: northEdgeLatitudeOfRow(y, atZoom),
		east: westEdgeLongitudeOfColumn(x + 1, atZoom),
	};
};

const lastIndexReachedByEdge = (fraction: number, atZoom: Zoom): number =>
	clampTileIndex(Math.ceil(fraction) - 1, atZoom);

const ensureAtLeastOneTile = (minIndex: number, maxIndex: number): number =>
	Math.max(minIndex, maxIndex);

export const tilesCovering = (
	bounds: TileBounds,
	atZoom: Zoom = CACHE_TILE_ZOOM
): readonly TileId[] => {
	const minX = columnContaining(bounds.west, atZoom);
	const maxX = ensureAtLeastOneTile(
		minX,
		lastIndexReachedByEdge(fractionalTileColumn(bounds.east, atZoom), atZoom)
	);
	const minY = rowContaining(bounds.north, atZoom);
	const maxY = ensureAtLeastOneTile(
		minY,
		lastIndexReachedByEdge(fractionalTileRow(bounds.south, atZoom), atZoom)
	);

	const ids: TileId[] = [];
	for (let x = minX; x <= maxX; x += 1) {
		for (let y = minY; y <= maxY; y += 1) {
			ids.push(formatTileId(atZoom, x, y));
		}
	}
	return ids;
};

export const boundsOfTiles = (ids: readonly TileId[]): TileBounds | null => {
	if (ids.length === 0) {
		return null;
	}

	let south = Number.POSITIVE_INFINITY;
	let west = Number.POSITIVE_INFINITY;
	let north = Number.NEGATIVE_INFINITY;
	let east = Number.NEGATIVE_INFINITY;

	for (const id of ids) {
		const bounds = tileBounds(id);
		south = Math.min(south, bounds.south);
		west = Math.min(west, bounds.west);
		north = Math.max(north, bounds.north);
		east = Math.max(east, bounds.east);
	}

	return { south, west, north, east };
};
