/**
 * Domain-specific branded types
 * These provide type safety for primitive values that have domain meaning
 */

/**
 * Branded type for Node IDs
 */
export type NodeId = string & { readonly __brand: 'NodeId' };

/**
 * Create a NodeId from a number
 */
export const nodeId = (id: number): NodeId => {
	return String(id) as NodeId;
};

/**
 * Branded type for Latitude (-90 to 90)
 */
export type Latitude = number & { readonly __brand: 'Latitude' };

/**
 * Create a Latitude with validation
 */
export const latitude = (value: number): Latitude | null => {
	if (!Number.isFinite(value) || value < -90 || value > 90) {
		return null;
	}
	return value as Latitude;
};

/**
 * Branded type for Longitude (-180 to 180)
 */
export type Longitude = number & { readonly __brand: 'Longitude' };

/**
 * Create a Longitude with validation
 */
export const longitude = (value: number): Longitude | null => {
	if (!Number.isFinite(value) || value < -180 || value > 180) {
		return null;
	}
	return value as Longitude;
};

/**
 * Branded type for hex color codes
 */
export type ColorCode = string & { readonly __brand: 'ColorCode' };

/**
 * Create a ColorCode with validation
 */
export const colorCode = (value: string): ColorCode | null => {
	if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
		return null;
	}
	return value as ColorCode;
};

/**
 * Validated coordinates pair
 */
export type Coordinates = {
	readonly lat: Latitude;
	readonly lon: Longitude;
};

/**
 * Create coordinates with validation
 */
export const coordinates = (lat: number, lon: number): Coordinates | null => {
	const validLat = latitude(lat);
	const validLon = longitude(lon);

	if (validLat === null || validLon === null) {
		return null;
	}

	return { lat: validLat, lon: validLon };
};
