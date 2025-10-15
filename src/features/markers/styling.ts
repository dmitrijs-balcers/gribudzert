/**
 * Marker styling logic
 * Generic marker style configuration and factory functions
 */

import * as L from 'leaflet';
import { MARKER_STYLE } from '../../core/config';
import type { Element } from '../../types/overpass';

/**
 * Marker icon type variants
 */
export type MarkerIconType = 'circle' | 'crossed' | 'custom';

/**
 * Marker visual style configuration
 */
export type MarkerStyle = {
	readonly color: string; // Border color (hex code)
	readonly fillColor: string; // Fill color (hex code)
	readonly radius: number; // Marker radius in pixels
	readonly weight: number; // Border weight in pixels
	readonly fillOpacity: number; // Fill opacity (0-1)
	readonly iconType?: MarkerIconType; // Marker shape variant
};

/**
 * Options for style generation
 */
export type StyleOptions = {
	readonly isNearest?: boolean; // Highlight as nearest point
	readonly isSeasonal?: boolean; // Reduced opacity for seasonal
	readonly isHighlighted?: boolean; // User-selected highlight
};

/**
 * Color palette for facility types
 */
export const FacilityColors = {
	// Water source colors (blue spectrum)
	water: {
		drinkingWater: '#4CAF50', // Green - drinking water amenity
		spring: '#00BCD4', // Cyan - natural spring
		waterWell: '#795548', // Brown - water well
		waterTap: '#2196F3', // Blue - water tap
		waterPoint: '#009688', // Teal - water point
		nonDrinkable: '#FF5722', // Deep Orange - non-drinkable warning
		default: '#0078ff', // Default blue
	},

	// Toilet colors (brown/tan spectrum)
	toilet: {
		accessible: '#8D6E63', // Brown - accessible toilet
		standard: '#A1887F', // Light brown - standard toilet
		premium: '#6D4C41', // Dark brown - premium/paid toilet
		default: '#795548', // Default brown
	},

	// UI colors
	ui: {
		nearest: '#FFD700', // Gold - nearest marker highlight
		selected: '#FF9800', // Orange - user selected
		disabled: '#9E9E9E', // Grey - disabled/closed
	},
} as const;

/**
 * Default marker radii
 */
export const MarkerRadius = {
	default: 6,
	bottle: 8, // Bottle refill available
	wheelchair: 8, // Wheelchair accessible
	highlighted: 9, // Nearest or selected
} as const;

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
 */
export function getWaterSourceColor(element: Element): string {
	// Non-drinkable water gets a warning color
	if (!isDrinkable(element)) {
		return FacilityColors.water.nonDrinkable;
	}

	// Check for specific water source types and assign colors
	if (element.tags.natural === 'spring') {
		return FacilityColors.water.spring;
	}
	if (element.tags.man_made === 'water_well') {
		return FacilityColors.water.waterWell;
	}
	if (element.tags.man_made === 'water_tap') {
		return FacilityColors.water.waterTap;
	}
	if (element.tags.waterway === 'water_point') {
		return FacilityColors.water.waterPoint;
	}
	if (element.tags.amenity === 'drinking_water') {
		return FacilityColors.water.drinkingWater;
	}

	// Fallback to default
	return FacilityColors.water.default;
}

/**
 * Get marker radius based on element tags
 */
export function getMarkerRadius(element: Element): number {
	if ((element.tags.bottle || '') === 'yes') {
		return MarkerRadius.bottle;
	}
	if ((element.tags.wheelchair || '') === 'yes') {
		return MarkerRadius.wheelchair;
	}
	return MarkerRadius.default;
}

/**
 * Check if marker should be seasonal (reduced opacity)
 */
export function isSeasonalMarker(element: Element): boolean {
	return (element.tags.seasonal || '').toLowerCase() === 'yes';
}

/**
 * Get marker style for water facility
 */
export function getWaterMarkerStyle(element: Element, options?: StyleOptions): MarkerStyle {
	const color = getWaterSourceColor(element);
	const radius = getMarkerRadius(element);
	const seasonal = isSeasonalMarker(element);
	const drinkable = isDrinkable(element);

	// Handle nearest/highlighted markers
	if (options?.isNearest || options?.isHighlighted) {
		return {
			color: FacilityColors.ui.nearest,
			fillColor: FacilityColors.ui.nearest,
			radius: MarkerRadius.highlighted,
			weight: 3,
			fillOpacity: seasonal || options.isSeasonal ? 0.3 : 0.6,
			iconType: drinkable ? 'circle' : 'crossed',
		};
	}

	return {
		color: MARKER_STYLE.color,
		fillColor: color,
		radius,
		weight: MARKER_STYLE.weight,
		fillOpacity: seasonal || options?.isSeasonal ? 0.3 : 0.6,
		iconType: drinkable ? 'circle' : 'crossed',
	};
}

/**
 * Check if toilet is wheelchair accessible
 */
function isWheelchairAccessible(element: Element): boolean {
	const wheelchair = (element.tags.wheelchair || '').toLowerCase();
	return wheelchair === 'yes';
}

/**
 * Check if toilet has fee
 */
function hasFee(element: Element): boolean {
	const fee = (element.tags.fee || '').toLowerCase();
	return fee === 'yes';
}

/**
 * Get marker color based on toilet type and accessibility
 */
export function getToiletColor(element: Element): string {
	// Wheelchair accessible toilets get accessible color
	if (isWheelchairAccessible(element)) {
		return FacilityColors.toilet.accessible;
	}

	// Premium/paid toilets get premium color
	if (hasFee(element)) {
		return FacilityColors.toilet.premium;
	}

	// Standard toilets get standard color
	return FacilityColors.toilet.standard;
}

/**
 * Get marker radius for toilet based on accessibility features
 */
export function getToiletRadius(element: Element): number {
	if (isWheelchairAccessible(element)) {
		return MarkerRadius.wheelchair;
	}
	return MarkerRadius.default;
}

/**
 * Get marker style for toilet facility
 */
export function getToiletMarkerStyle(element: Element, options?: StyleOptions): MarkerStyle {
	const color = getToiletColor(element);
	const radius = getToiletRadius(element);

	// Handle nearest/highlighted markers
	if (options?.isNearest || options?.isHighlighted) {
		return {
			color: FacilityColors.ui.nearest,
			fillColor: FacilityColors.ui.nearest,
			radius: MarkerRadius.highlighted,
			weight: 3,
			fillOpacity: 0.7,
			iconType: 'circle',
		};
	}

	return {
		color: MARKER_STYLE.color,
		fillColor: color,
		radius,
		weight: MARKER_STYLE.weight,
		fillOpacity: 0.7,
		iconType: 'circle',
	};
}

/**
 * Create a crossed-out circle marker for non-drinkable water
 */
function createCrossedOutMarker(lat: number, lon: number, style: MarkerStyle): L.Marker {
	const size = style.radius * 2 + 4;
	const center = size / 2;

	// Create SVG with circle and diagonal cross
	const svgIcon = L.divIcon({
		html: `
			<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
				<circle cx="${center}" cy="${center}" r="${style.radius}"
					fill="${style.fillColor}"
					fill-opacity="${style.fillOpacity}"
					stroke="${style.color}"
					stroke-width="${style.weight}"/>
				<line x1="${center - style.radius * 0.6}" y1="${center - style.radius * 0.6}"
					x2="${center + style.radius * 0.6}" y2="${center + style.radius * 0.6}"
					stroke="#333"
					stroke-width="2.5"
					stroke-linecap="round"/>
				<line x1="${center + style.radius * 0.6}" y1="${center - style.radius * 0.6}"
					x2="${center - style.radius * 0.6}" y2="${center + style.radius * 0.6}"
					stroke="#333"
					stroke-width="2.5"
					stroke-linecap="round"/>
			</svg>
		`,
		className: 'non-drinkable-marker',
		iconSize: [size, size],
		iconAnchor: [center, center],
	});

	return L.marker([lat, lon], { icon: svgIcon });
}

/**
 * Create a generic marker with the provided style
 */
export function createGenericMarker(
	lat: number,
	lon: number,
	style: MarkerStyle
): L.CircleMarker | L.Marker {
	// Use crossed-out marker for non-drinkable water
	if (style.iconType === 'crossed') {
		return createCrossedOutMarker(lat, lon, style);
	}

	// Standard circle marker
	return L.circleMarker([lat, lon], {
		radius: style.radius,
		color: style.color,
		weight: style.weight,
		fillColor: style.fillColor,
		fillOpacity: style.fillOpacity,
		className: style.iconType === 'custom' ? 'custom-marker' : '',
	});
}
