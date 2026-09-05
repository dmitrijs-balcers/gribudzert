/**
 * Marker styling logic
 * Maps domain facilities to visual marker styles and creates Leaflet markers.
 */

import * as L from 'leaflet';
import { MARKER_STYLE } from '../../core/config';
import type {
	Facility,
	LatLon,
	ToiletFacility,
	WaterFacility,
	WaterSourceType,
} from '../../domain';
import { isWheelchairAccessible } from '../../domain';

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
	readonly isHighlighted?: boolean; // User-selected highlight
};

/**
 * Options for marker creation
 */
export type MarkerFactoryOptions = {
	readonly className?: string; // Extra CSS class applied to the marker element
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
 * Fill color per water source type
 */
const WATER_SOURCE_COLORS: Readonly<Record<WaterSourceType, string>> = {
	drinking_water: FacilityColors.water.drinkingWater,
	spring: FacilityColors.water.spring,
	water_well: FacilityColors.water.waterWell,
	water_tap: FacilityColors.water.waterTap,
	water_point: FacilityColors.water.waterPoint,
};

/**
 * Get marker color based on water source type (non-drinkable water gets a warning color)
 */
export function getWaterSourceColor(facility: WaterFacility): string {
	if (!facility.drinkable) {
		return FacilityColors.water.nonDrinkable;
	}
	return WATER_SOURCE_COLORS[facility.sourceType];
}

/**
 * Get marker radius for a water facility
 */
export function getMarkerRadius(facility: WaterFacility): number {
	if (facility.bottleRefill) {
		return MarkerRadius.bottle;
	}
	if (facility.wheelchair === 'yes') {
		return MarkerRadius.wheelchair;
	}
	return MarkerRadius.default;
}

/**
 * Get marker style for water facility
 */
export function getWaterMarkerStyle(facility: WaterFacility, options?: StyleOptions): MarkerStyle {
	const fillOpacity = facility.seasonal ? 0.3 : 0.6;
	const iconType: MarkerIconType = facility.drinkable ? 'circle' : 'crossed';

	// Handle nearest/highlighted markers
	if (options?.isNearest || options?.isHighlighted) {
		return {
			color: FacilityColors.ui.nearest,
			fillColor: FacilityColors.ui.nearest,
			radius: MarkerRadius.highlighted,
			weight: 3,
			fillOpacity,
			iconType,
		};
	}

	return {
		color: MARKER_STYLE.color,
		fillColor: getWaterSourceColor(facility),
		radius: getMarkerRadius(facility),
		weight: MARKER_STYLE.weight,
		fillOpacity,
		iconType,
	};
}

/**
 * Get marker color based on toilet type and accessibility
 */
export function getToiletColor(facility: ToiletFacility): string {
	if (isWheelchairAccessible(facility)) {
		return FacilityColors.toilet.accessible;
	}
	if (facility.fee === 'yes') {
		return FacilityColors.toilet.premium;
	}
	return FacilityColors.toilet.standard;
}

/**
 * Get marker radius for toilet based on accessibility features
 */
export function getToiletRadius(facility: ToiletFacility): number {
	return isWheelchairAccessible(facility) ? MarkerRadius.wheelchair : MarkerRadius.default;
}

/**
 * Get marker style for toilet facility
 */
export function getToiletMarkerStyle(
	facility: ToiletFacility,
	options?: StyleOptions
): MarkerStyle {
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
		fillColor: getToiletColor(facility),
		radius: getToiletRadius(facility),
		weight: MARKER_STYLE.weight,
		fillOpacity: 0.7,
		iconType: 'circle',
	};
}

/**
 * Get marker style for any facility
 */
export function getMarkerStyle(facility: Facility, options?: StyleOptions): MarkerStyle {
	switch (facility.kind) {
		case 'water':
			return getWaterMarkerStyle(facility, options);
		case 'toilet':
			return getToiletMarkerStyle(facility, options);
	}
}

/**
 * Join CSS class names, dropping empty ones
 */
const classNames = (...names: readonly (string | undefined)[]): string =>
	names.filter((name): name is string => name !== undefined && name !== '').join(' ');

/**
 * Create a crossed-out circle marker for non-drinkable water
 */
function createCrossedOutMarker(
	position: LatLon,
	style: MarkerStyle,
	options?: MarkerFactoryOptions
): L.Marker {
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
		className: classNames('non-drinkable-marker', options?.className),
		iconSize: [size, size],
		iconAnchor: [center, center],
	});

	return L.marker([position.lat, position.lon], { icon: svgIcon });
}

/**
 * Create a marker with the provided style.
 * Extra CSS classes are passed through the factory options rather than mutated afterwards.
 */
export function createGenericMarker(
	position: LatLon,
	style: MarkerStyle,
	options?: MarkerFactoryOptions
): L.CircleMarker | L.Marker {
	// Use crossed-out marker for non-drinkable water
	if (style.iconType === 'crossed') {
		return createCrossedOutMarker(position, style, options);
	}

	// Standard circle marker
	return L.circleMarker([position.lat, position.lon], {
		radius: style.radius,
		color: style.color,
		weight: style.weight,
		fillColor: style.fillColor,
		fillOpacity: style.fillOpacity,
		className: classNames(style.iconType === 'custom' ? 'custom-marker' : '', options?.className),
	});
}
