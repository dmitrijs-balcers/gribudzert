/**
 * Marker creation and management
 */

import type * as L from 'leaflet';
import type { Element } from '../../types/overpass';
import { attachPopupHandlers, createPopupContent } from './popup';
import {
	createGenericMarker,
	getToiletMarkerStyle,
	getWaterMarkerStyle,
	isSeasonalMarker,
} from './styling';

/**
 * Create a circle marker for a water tap element
 */
function createMarker(element: Element, isNearest = false): L.CircleMarker | L.Marker | null {
	// Validate coordinates
	if (!Number.isFinite(element.lat) || !Number.isFinite(element.lon)) {
		return null;
	}

	// Get marker style using generic styling function
	const seasonal = isSeasonalMarker(element);
	const style = getWaterMarkerStyle(element, { isNearest, isSeasonal: seasonal });

	// Create marker using generic factory
	const marker = createGenericMarker(element.lat, element.lon, style);

	// Add nearest class if applicable
	if (isNearest && 'options' in marker) {
		marker.options.className = 'nearest-marker';
	}

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
	layer: L.FeatureGroup<L.CircleMarker | L.Marker>,
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

/**
 * Create a circle marker for a toilet element
 */
function createToiletMarker(element: Element, isNearest = false): L.CircleMarker | L.Marker | null {
	// Validate coordinates
	if (!Number.isFinite(element.lat) || !Number.isFinite(element.lon)) {
		return null;
	}

	// Get marker style using toilet styling function
	const style = getToiletMarkerStyle(element, { isNearest });

	// Create marker using generic factory
	const marker = createGenericMarker(element.lat, element.lon, style);

	// Add nearest class if applicable
	if (isNearest && 'options' in marker) {
		marker.options.className = 'nearest-marker';
	}

	return marker;
}

/**
 * Add toilet markers to a layer
 * @param elements - Array of toilet elements
 * @param layer - Leaflet layer to add markers to
 * @param map - Leaflet map instance (for popup handlers)
 * @param nearestPoint - Optional nearest toilet to highlight
 */
export function addToiletMarkers(
	elements: Element[],
	layer: L.FeatureGroup<L.CircleMarker | L.Marker>,
	_map: L.Map,
	nearestPoint: Element | null = null
): void {
	elements.forEach((element) => {
		const isNearest = nearestPoint !== null && element.id === nearestPoint.id;
		const marker = createToiletMarker(element, isNearest);
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
