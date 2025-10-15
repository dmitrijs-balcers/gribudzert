/**
 * Data Transformers
 * Functions to transform Overpass elements into Facility types
 */

import type {
	ChangingTable,
	FeeStatus,
	ToiletAccessibility,
	ToiletDetails,
	ToiletFacility,
	WaterFacility,
	WaterSourceType,
	WheelchairAccess,
} from '../../types/facilities';
import type { Element } from '../../types/overpass';

/**
 * Transform Overpass element to WaterFacility
 */
export function elementToWaterFacility(element: Element): WaterFacility {
	return {
		kind: 'water',
		element,
		drinkable: isDrinkable(element),
		sourceType: getWaterSourceType(element),
	};
}

/**
 * Transform Overpass element to ToiletFacility
 */
export function elementToToiletFacility(element: Element): ToiletFacility {
	return {
		kind: 'toilet',
		element,
		accessibility: extractAccessibility(element),
		details: extractToiletDetails(element),
	};
}

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
 * Determine water source type from tags
 */
function getWaterSourceType(element: Element): WaterSourceType {
	if (element.tags.amenity === 'drinking_water') return 'drinking_water';
	if (element.tags.natural === 'spring') return 'spring';
	if (element.tags.man_made === 'water_well') return 'water_well';
	if (element.tags.man_made === 'water_tap') return 'water_tap';
	if (element.tags.waterway === 'water_point') return 'water_point';
	return 'unknown';
}

/**
 * Extract accessibility information from toilet tags
 */
function extractAccessibility(element: Element): ToiletAccessibility {
	return {
		wheelchair: parseWheelchairTag(element.tags.wheelchair),
		changingTable: parseChangingTableTag(element.tags.changing_table),
	};
}

/**
 * Extract toilet details from tags
 */
function extractToiletDetails(element: Element): ToiletDetails {
	return {
		fee: parseFeeTag(element.tags.fee),
		openingHours: element.tags.opening_hours || null,
		unisex: parseUnisexTag(element.tags.unisex),
	};
}

/**
 * Parse wheelchair tag with fallback to unknown
 */
function parseWheelchairTag(value: string | undefined): WheelchairAccess {
	if (!value) return 'unknown';
	const normalized = value.toLowerCase();
	if (normalized === 'yes') return 'yes';
	if (normalized === 'no') return 'no';
	if (normalized === 'limited') return 'limited';
	return 'unknown';
}

/**
 * Parse changing_table tag with fallback to unknown
 */
function parseChangingTableTag(value: string | undefined): ChangingTable {
	if (!value) return 'unknown';
	const normalized = value.toLowerCase();
	if (normalized === 'yes') return 'yes';
	if (normalized === 'no') return 'no';
	return 'unknown';
}

/**
 * Parse fee tag with fallback to unknown
 */
function parseFeeTag(value: string | undefined): FeeStatus {
	if (!value) return 'unknown';
	const normalized = value.toLowerCase();
	if (normalized === 'yes') return 'yes';
	if (normalized === 'no') return 'no';
	return 'unknown';
}

/**
 * Parse unisex tag (null if not specified)
 */
function parseUnisexTag(value: string | undefined): boolean | null {
	if (!value) return null;
	const normalized = value.toLowerCase();
	return normalized === 'yes';
}

/**
 * Check if toilet is accessible (wheelchair=yes only)
 */
export function isAccessible(facility: ToiletFacility): boolean {
	return facility.accessibility.wheelchair === 'yes';
}

/**
 * Find nearest toilet from a list of toilets to a given location
 */
export function findNearestToilet(
	toilets: ToiletFacility[],
	userLocation: { lat: number; lon: number }
): ToiletFacility | null {
	if (toilets.length === 0) return null;

	let nearest: ToiletFacility | null = null;
	let minDistance = Number.POSITIVE_INFINITY;

	for (const toilet of toilets) {
		const distance = calculateDistance(
			userLocation.lat,
			userLocation.lon,
			toilet.element.lat,
			toilet.element.lon
		);

		if (distance < minDistance) {
			minDistance = distance;
			nearest = toilet;
		}
	}

	return nearest;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371; // Earth's radius in kilometers
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
	return degrees * (Math.PI / 180);
}
