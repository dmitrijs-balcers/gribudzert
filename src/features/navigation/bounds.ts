/**
 * Pure bounds helpers shared by viewport exploration and navigation handling, plus the
 * conversion between Leaflet's `L.LatLngBounds` and the library-independent `TileBounds` the
 * domain tile grid works with. This is the only place in the app that does that conversion -
 * `src/domain/tile.ts` must not import Leaflet.
 */

import * as L from 'leaflet';
import type { TileBounds } from '../../domain';

/**
 * Pad a Leaflet bounds by a factor of its own size.
 *
 * `factor` is the ratio between the padded area's size and the original: 1 leaves the
 * bounds unchanged, 2 doubles both width and height (the padded area is centered on the
 * original bounds). Leaflet's own `LatLngBounds.pad(ratio)` grows each side by `ratio` of
 * the size, so doubling the total size needs half of that on each side, i.e.
 * `ratio = (factor - 1) / 2`.
 *
 * @param bounds - Bounds to pad
 * @param factor - Size multiplier (1 = no padding, 2 = double width and height)
 */
export const padBounds = (bounds: L.LatLngBounds, factor: number): L.LatLngBounds =>
	bounds.pad((factor - 1) / 2);

/**
 * Convert a Leaflet bounds to the library-independent `TileBounds` shape
 */
export const toTileBounds = (bounds: L.LatLngBounds): TileBounds => {
	const sw = bounds.getSouthWest();
	const ne = bounds.getNorthEast();
	return { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng };
};

/**
 * Convert a `TileBounds` back into a Leaflet bounds
 */
export const toLatLngBounds = (bounds: TileBounds): L.LatLngBounds =>
	L.latLngBounds([bounds.south, bounds.west], [bounds.north, bounds.east]);
