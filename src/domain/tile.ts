/**
 * Slippy-map tile grid
 * The offline facility cache covers the world in tiles at a fixed zoom (`CACHE_TILE_ZOOM`):
 * every fetch, and every cached facility, is aligned to this grid rather than to the
 * viewer's actual zoom. Pure standard slippy-map math; no Leaflet import - the conversion
 * to and from `L.LatLngBounds` lives in `src/features/navigation/bounds.ts`.
 */

import { CACHE_TILE_ZOOM } from '../core/config';
import type { LatLon } from './geo';

/**
 * Branded tile identifier, `"{zoom}/{x}/{y}"` (e.g. `"13/2341/1189"`)
 */
export type TileId = string & { readonly __brand: 'TileId' };

/**
 * Geographic bounds of a tile (or a union of tiles), independent of any mapping library
 */
export type TileBounds = {
	readonly south: number;
	readonly west: number;
	readonly north: number;
	readonly east: number;
};

/**
 * Latitude range the slippy-map Mercator projection can represent
 */
const MAX_LATITUDE = 85.0511;

/**
 * Clamp a latitude to the range the tile grid can represent
 */
const clampLatitude = (lat: number): number => Math.min(MAX_LATITUDE, Math.max(-MAX_LATITUDE, lat));

/**
 * Clamp a tile coordinate to the valid range for the given zoom
 */
const clampTileCoord = (value: number, zoom: number): number =>
	Math.min(2 ** zoom - 1, Math.max(0, value));

/**
 * Fractional tile column a longitude falls at, at the given zoom (unclamped, un-floored) - the
 * shared building block for both the west edge (`floor`) and the east edge (`ceil - 1`) of a
 * range of tiles
 */
const lonFraction = (lon: number, zoom: number): number => ((lon + 180) / 360) * 2 ** zoom;

/**
 * Fractional tile row a latitude falls at, at the given zoom (unclamped, un-floored) - the
 * shared building block for both the north edge (`floor`) and the south edge (`ceil - 1`) of a
 * range of tiles
 */
const latYFraction = (lat: number, zoom: number): number => {
	const radians = (clampLatitude(lat) * Math.PI) / 180;
	const y = (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2;
	return y * 2 ** zoom;
};

/**
 * Tile column containing a longitude, at the given zoom
 */
const tileX = (lon: number, zoom: number): number =>
	clampTileCoord(Math.floor(lonFraction(lon, zoom)), zoom);

/**
 * Tile row containing a latitude, at the given zoom (`y` grows southward)
 */
const tileY = (lat: number, zoom: number): number =>
	clampTileCoord(Math.floor(latYFraction(lat, zoom)), zoom);

/**
 * West edge longitude of tile column `x` at the given zoom
 */
const lonOfTileX = (x: number, zoom: number): number => (x / 2 ** zoom) * 360 - 180;

/**
 * North edge latitude of tile row `y` at the given zoom
 */
const latOfTileY = (y: number, zoom: number): number => {
	const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
	return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

/**
 * Build a TileId from its parts. Not exported: callers go through `tileOf` or `parseTileId`.
 */
const tileId = (zoom: number, x: number, y: number): TileId => `${zoom}/${x}/${y}` as TileId;

/**
 * TileId of the tile containing a point, at the given zoom (default `CACHE_TILE_ZOOM`).
 * Latitude is clamped to the range the projection supports before computing the row.
 */
export const tileOf = (point: LatLon, zoom: number = CACHE_TILE_ZOOM): TileId =>
	tileId(zoom, tileX(point.lon, zoom), tileY(point.lat, zoom));

/**
 * Parse a TileId string into its parts, or null when it is not `"{zoom}/{x}/{y}"` with a
 * non-negative integer zoom and `x`/`y` inside the grid for that zoom. Validated boundary:
 * this is the only place that trusts a raw string as a tile identifier.
 */
export const parseTileId = (
	id: string
): { readonly zoom: number; readonly x: number; readonly y: number } | null => {
	const match = /^(\d+)\/(\d+)\/(\d+)$/.exec(id);
	if (match === null) {
		return null;
	}
	const zoom = Number(match[1]);
	const x = Number(match[2]);
	const y = Number(match[3]);
	const size = 2 ** zoom;
	if (x >= size || y >= size) {
		return null;
	}
	return { zoom, x, y };
};

/**
 * Parts of a TileId known to be well-formed (constructed by `tileOf` or a successful
 * `parseTileId`). Throws only if that invariant was somehow violated.
 */
const partsOf = (id: TileId): { readonly zoom: number; readonly x: number; readonly y: number } => {
	const parsed = parseTileId(id);
	if (parsed === null) {
		throw new Error(`Invalid TileId: ${id}`);
	}
	return parsed;
};

/**
 * Geographic bounds of a single tile
 */
export const tileBounds = (id: TileId): TileBounds => {
	const { zoom, x, y } = partsOf(id);
	return {
		south: latOfTileY(y + 1, zoom),
		west: lonOfTileX(x, zoom),
		north: latOfTileY(y, zoom),
		east: lonOfTileX(x + 1, zoom),
	};
};

/**
 * Every tile that intersects `bounds` at the given zoom (default `CACHE_TILE_ZOOM`): the tiles
 * containing its south-west and north-east corners, and everything between.
 *
 * The west and north edges use `floor` (the tile a boundary value starts in), but the east and
 * south edges use `ceil(fraction) - 1`: with plain `floor`, a bounds whose edge sits exactly on
 * a tile boundary - true of every tile-aligned bbox, including every one this module hands back
 * from `boundsOfTiles` - would resolve to the tile just *past* that edge, over-claiming one
 * extra column or row that the bounds do not actually reach into. `ceil - 1` instead resolves
 * an exact boundary to the tile that ends there. The two only disagree on an exact boundary;
 * elsewhere `ceil(fraction) - 1 === floor(fraction)`. Degenerate (zero-width or zero-height)
 * bounds are clamped so `maxX >= minX` and `maxY >= minY`: a point still covers the one tile
 * that contains it, rather than an empty range.
 */
export const tilesCovering = (
	bounds: TileBounds,
	zoom: number = CACHE_TILE_ZOOM
): readonly TileId[] => {
	const minX = tileX(bounds.west, zoom);
	const maxX = Math.max(minX, clampTileCoord(Math.ceil(lonFraction(bounds.east, zoom)) - 1, zoom));
	const minY = tileY(bounds.north, zoom);
	const maxY = Math.max(
		minY,
		clampTileCoord(Math.ceil(latYFraction(bounds.south, zoom)) - 1, zoom)
	);

	const ids: TileId[] = [];
	for (let x = minX; x <= maxX; x += 1) {
		for (let y = minY; y <= maxY; y += 1) {
			ids.push(tileId(zoom, x, y));
		}
	}
	return ids;
};

/**
 * Tile-aligned bounding hull of a set of tiles (their union's outer edge), or null when
 * `ids` is empty
 */
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
