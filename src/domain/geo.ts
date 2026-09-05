/**
 * Geographic value types
 * Branded primitives that carry validated domain meaning, plus the pure
 * distance helpers built on top of them.
 */

import { haversineDistance } from '../utils/geometry';

/**
 * Branded type for Latitude (-90 to 90)
 */
export type Latitude = number & { readonly __brand: 'Latitude' };

/**
 * Branded type for Longitude (-180 to 180)
 */
export type Longitude = number & { readonly __brand: 'Longitude' };

/**
 * Validated coordinate pair
 */
export type Coordinates = {
	readonly lat: Latitude;
	readonly lon: Longitude;
};

/**
 * Unvalidated latitude/longitude pair (e.g. a map centre). `Coordinates` is assignable to it.
 */
export type LatLon = {
	readonly lat: number;
	readonly lon: number;
};

/**
 * Branded type for a non-negative distance in meters
 */
export type Meters = number & { readonly __brand: 'Meters' };

/**
 * Create a Latitude, or null when the value is not a finite number within [-90, 90]
 */
export const latitude = (value: number): Latitude | null => {
	if (!Number.isFinite(value) || value < -90 || value > 90) {
		return null;
	}
	return value as Latitude;
};

/**
 * Create a Longitude, or null when the value is not a finite number within [-180, 180]
 */
export const longitude = (value: number): Longitude | null => {
	if (!Number.isFinite(value) || value < -180 || value > 180) {
		return null;
	}
	return value as Longitude;
};

/**
 * Create validated Coordinates, or null when either component is out of range
 */
export const coordinates = (lat: number, lon: number): Coordinates | null => {
	const validLat = latitude(lat);
	const validLon = longitude(lon);

	if (validLat === null || validLon === null) {
		return null;
	}

	return { lat: validLat, lon: validLon };
};

/**
 * Create a Meters value, or null when the value is negative or not finite
 */
export const meters = (value: number): Meters | null => {
	if (!Number.isFinite(value) || value < 0) {
		return null;
	}
	return value as Meters;
};

/**
 * Great-circle distance between two points
 * @returns Distance in meters
 */
export const distanceBetween = (from: LatLon, to: LatLon): Meters => {
	return haversineDistance(from.lat, from.lon, to.lat, to.lon) as Meters;
};

/**
 * Human readable distance: whole meters below 1 km, otherwise kilometers with two decimals
 */
export const formatDistance = (distance: Meters): string => {
	if (distance < 1000) {
		return `${Math.round(distance)}m`;
	}
	return `${(distance / 1000).toFixed(2)}km`;
};
