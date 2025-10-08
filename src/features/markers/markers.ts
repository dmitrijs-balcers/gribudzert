/**
 * Marker creation and management
 */

import * as L from 'leaflet';
import type { Element } from '../../types/overpass';
import { COLOUR_MAP, MARKER_RADIUS, MARKER_STYLE } from '../../core/config';
import { createPopupContent, attachPopupHandlers } from './popup';

/**
 * Get marker color based on element tags
 */
function getMarkerColor(element: Element): string {
	const colorTag = (element.tags.colour || '').toLowerCase();
	const color = (COLOUR_MAP as Record<string, string>)[colorTag];
	return color ?? COLOUR_MAP.default ?? '#0078ff';
}

/**
 * Get marker radius based on element tags
 */
function getMarkerRadius(element: Element): number {
	if ((element.tags.bottle || '') === 'yes') {
		return MARKER_RADIUS.bottle;
	}
	if ((element.tags.wheelchair || '') === 'yes') {
		return MARKER_RADIUS.wheelchair;
	}
	return MARKER_RADIUS.default;
}

/**
 * Check if marker should be seasonal (reduced opacity)
 */
function isSeasonalMarker(element: Element): boolean {
	return (element.tags.seasonal || '').toLowerCase() === 'yes';
}

/**
 * Create a circle marker for a water tap element
 */
function createMarker(element: Element): L.CircleMarker | null {
	// Validate coordinates
	if (!Number.isFinite(element.lat) || !Number.isFinite(element.lon)) {
		return null;
	}

	const color = getMarkerColor(element);
	const radius = getMarkerRadius(element);
	const seasonal = isSeasonalMarker(element);

	const marker = L.circleMarker([element.lat, element.lon], {
		radius,
		color: MARKER_STYLE.color,
		weight: MARKER_STYLE.weight,
		fillColor: color,
		fillOpacity: seasonal ? MARKER_STYLE.fillOpacity.seasonal : MARKER_STYLE.fillOpacity.normal,
	});

	return marker;
}

/**
 * Add water tap markers to a layer
 * @param elements - Array of water tap elements
 * @param layer - Leaflet layer to add markers to
 * @param map - Leaflet map instance (for popup handlers)
 */
export function addMarkers(
	elements: Element[],
	layer: L.FeatureGroup<L.CircleMarker>,
	_map: L.Map
): void {
	elements.forEach((element) => {
		const marker = createMarker(element);
		if (!marker) return;

		// Add marker to layer
		marker.addTo(layer);

		// Create and bind popup
		const popupContent = createPopupContent(element);
		marker.bindPopup(popupContent);

		// Attach popup event handlers
		attachPopupHandlers(marker, element);
	});
}

// Keep backward compatibility alias
export const addMarkersToLayer = addMarkers;
