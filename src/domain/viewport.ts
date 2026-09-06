import type { LatLon } from './geo';
import type { TileBounds, TileId } from './tile';
import { tilesCovering } from './tile';
import type { Zoom } from './units';

export type Viewport = {
	readonly bounds: TileBounds;
	readonly zoom: Zoom;
	readonly center: LatLon;
};

export type FetchableViewport = Viewport & { readonly __fetchable: true };

export type ViewportClass =
	| { readonly kind: 'fetchable'; readonly viewport: FetchableViewport }
	| { readonly kind: 'zoomed-out'; readonly viewport: Viewport };

export const classify = (viewport: Viewport, minFetchZoom: Zoom): ViewportClass =>
	viewport.zoom >= minFetchZoom
		? { kind: 'fetchable', viewport: viewport as FetchableViewport }
		: { kind: 'zoomed-out', viewport };

const padRatioOf = (sizeMultiplier: number): number => (sizeMultiplier - 1) / 2;

export const padTileBounds = (bounds: TileBounds, sizeMultiplier: number): TileBounds => {
	const ratio = padRatioOf(sizeMultiplier);
	const latPad = (bounds.north - bounds.south) * ratio;
	const lonPad = (bounds.east - bounds.west) * ratio;
	return {
		south: bounds.south - latPad,
		west: bounds.west - lonPad,
		north: bounds.north + latPad,
		east: bounds.east + lonPad,
	};
};

const zoomChangedSince = (previous: Viewport | null, viewport: Viewport): boolean =>
	previous !== null && previous.zoom !== viewport.zoom;

export const tilesThatMustBeLoaded = (
	viewport: Viewport,
	previous: Viewport | null,
	paddedNeededTiles: readonly TileId[]
): readonly TileId[] =>
	zoomChangedSince(previous, viewport) ? paddedNeededTiles : tilesCovering(viewport.bounds);
