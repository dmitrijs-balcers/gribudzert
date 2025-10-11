/**
 * Marker creation and management
 */

import * as L from 'leaflet';
import type { Element } from '../../types/overpass';
import { COLOUR_MAP, MARKER_RADIUS, MARKER_STYLE } from '../../core/config';
import { createPopupContent, attachPopupHandlers } from './popup';

/**
 * Check if water source is drinkable
 */
function isDrinkable(element: Element): boolean {
	const drinkingWater = (element.tags.drinking_water || '').toLowerCase();
	// Explicit "no" means not drinkable
	if (drinkingWater === 'no') {
		return false;
	}
	// amenity=drinking_water is assumed drinkable unless tagged otherwise
	if (element.tags.amenity === 'drinking_water') {
		return true;
	}
	// For other water sources, assume drinkable if not explicitly marked
	return drinkingWater !== 'no';
}

/**
 * Get marker color based on water source type
 * Priority: source type > colour tag > default
 */
function getWaterSourceColor(element: Element): string {
	// Non-drinkable water gets a warning color
	if (!isDrinkable(element)) {
		return '#FF5722'; // Deep Orange - warning color for non-drinkable
	}

	// Check for specific water source types and assign colors
	if (element.tags.natural === 'spring') {
		return '#00BCD4'; // Cyan - natural spring
	}
	if (element.tags.man_made === 'water_well') {
		return '#795548'; // Brown - water well
	}
	if (element.tags.man_made === 'water_tap') {
		return '#2196F3'; // Blue - water tap
	}
	if (element.tags.waterway === 'water_point') {
		return '#009688'; // Teal - water point
	}
	if (element.tags.amenity === 'drinking_water') {
		return '#4CAF50'; // Green - drinking water amenity
	}

	// Fallback to color tag if present
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
 * Create a crossed-out circle marker for non-drinkable water
 */
function createCrossedOutMarker(element: Element, color: string, radius: number): L.Marker {
	const size = radius * 2 + 4;
	const center = size / 2;

	// Create SVG with circle and diagonal cross
	const svgIcon = L.divIcon({
		html: `
			<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
				<circle cx="${center}" cy="${center}" r="${radius}"
					fill="${color}"
					fill-opacity="0.6"
					stroke="#333"
					stroke-width="2"/>
				<line x1="${center - radius * 0.6}" y1="${center - radius * 0.6}"
					x2="${center + radius * 0.6}" y2="${center + radius * 0.6}"
					stroke="#333"
					stroke-width="2.5"
					stroke-linecap="round"/>
				<line x1="${center + radius * 0.6}" y1="${center - radius * 0.6}"
					x2="${center - radius * 0.6}" y2="${center + radius * 0.6}"
					stroke="#333"
					stroke-width="2.5"
					stroke-linecap="round"/>
			</svg>
		`,
		className: 'non-drinkable-marker',
		iconSize: [size, size],
		iconAnchor: [center, center],
	});

	return L.marker([element.lat, element.lon], { icon: svgIcon });
}

/**
 * Create a circle marker for a water tap element
 */
function createMarker(element: Element, isNearest = false): L.CircleMarker | L.Marker | null {
	// Validate coordinates
	if (!Number.isFinite(element.lat) || !Number.isFinite(element.lon)) {
		return null;
	}

	const color = getWaterSourceColor(element);
	const radius = getMarkerRadius(element);
	const seasonal = isSeasonalMarker(element);

	// Use crossed-out marker for non-drinkable water
	if (!isDrinkable(element)) {
		return createCrossedOutMarker(element, color, radius + 2);
	}

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
