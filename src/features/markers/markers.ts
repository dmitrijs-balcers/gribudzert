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
function createMarker(element: Element, isNearest = false): L.CircleMarker | null {
	// Validate coordinates
	if (!Number.isFinite(element.lat) || !Number.isFinite(element.lon)) {
		return null;
	}

	const color = getMarkerColor(element);
	const radius = getMarkerRadius(element);
	const seasonal = isSeasonalMarker(element);

	const marker = L.circleMarker([element.lat, element.lon], {
		radius: isNearest ? radius + 3 : radius,
		color: isNearest ? '#FFD700' : MARKER_STYLE.color,
		weight: isNearest ? 3 : MARKER_STYLE.weight,
		fillColor: isNearest ? '#FFD700' : color,
		fillOpacity: seasonal ? MARKER_STYLE.fillOpacity.seasonal : MARKER_STYLE.fillOpacity.normal,
		className: isNearest ? 'nearest-marker' : '',
	});

	return marker;
}

/**
 * Add water tap markers to a layer
 * @param elements - Array of water tap elements
 * @param layer - Leaflet layer to add markers to
 * @param map - Leaflet map instance (for popup handlers)
 * @param nearestPoint - Optional nearest water point to highlight
 */
export function addMarkers(
	elements: Element[],
	layer: L.FeatureGroup<L.CircleMarker>,
	_map: L.Map,
	nearestPoint: Element | null = null
): void {
	elements.forEach((element) => {
		const isNearest = nearestPoint !== null && element.id === nearestPoint.id;
		const marker = createMarker(element, isNearest);
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
