/**
 * Marker creation and management
 */

import type * as L from 'leaflet';
import type { Facility, Located } from '../../domain';
import { attachPopupHandlers, createPopupContent } from './popup';
import { createGenericMarker, getMarkerStyle } from './styling';

/**
 * CSS class applied to the marker flagged as nearest
 */
export const NEAREST_MARKER_CLASS = 'nearest-marker';

/**
 * Layer type that can hold both circle markers and icon markers
 */
export type FacilityLayer = L.FeatureGroup<L.CircleMarker | L.Marker>;

/**
 * Create a styled marker for a located facility
 */
export function createFacilityMarker(item: Located<Facility>): L.CircleMarker | L.Marker {
	const style = getMarkerStyle(item.facility, { isNearest: item.isNearest });
	const options = item.isNearest ? { className: NEAREST_MARKER_CLASS } : {};
	return createGenericMarker(item.facility.coordinates, style, options);
}

/**
 * Add markers for located facilities to a layer, binding popups and handlers
 * @param items - Facilities enriched with distance information
 * @param layer - Leaflet layer to add markers to
 */
export function addMarkers(items: readonly Located<Facility>[], layer: FacilityLayer): void {
	for (const item of items) {
		const marker = createFacilityMarker(item);
		marker.addTo(layer);
		marker.bindPopup(createPopupContent(item));
		attachPopupHandlers(marker, item.facility);
	}
}
