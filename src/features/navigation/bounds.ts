/**
 * Pure bounds helpers shared by viewport exploration and navigation handling
 */

import type * as L from 'leaflet';

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
