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

/**
 * Branded type for a compass heading in degrees, `0 <= v < 360`
 */
export type Heading = number & { readonly __brand: 'Heading' };

/**
 * Branded type for a non-negative speed in meters per second
 */
export type MetersPerSecond = number & { readonly __brand: 'MetersPerSecond' };

/**
 * Create a Heading, or null when the value is not finite or outside [0, 360)
 */
export const heading = (value: number): Heading | null => {
	if (!Number.isFinite(value) || value < 0 || value >= 360) {
		return null;
	}
	return value as Heading;
};

/**
 * Create a MetersPerSecond value, or null when the value is negative or not finite
 */
export const metersPerSecond = (value: number): MetersPerSecond | null => {
	if (!Number.isFinite(value) || value < 0) {
		return null;
	}
	return value as MetersPerSecond;
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

const normalizeDegrees = (value: number): number => ((value % 360) + 360) % 360;

/**
 * Initial great-circle bearing from `from` to `to`, normalised to [0, 360)
 */
export const bearingBetween = (from: LatLon, to: LatLon): Heading => {
	const fromLat = toRadians(from.lat);
	const toLat = toRadians(to.lat);
	const deltaLon = toRadians(to.lon - from.lon);

	const y = Math.sin(deltaLon) * Math.cos(toLat);
	const x =
		Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon);

	return normalizeDegrees(toDegrees(Math.atan2(y, x))) as Heading;
};

/**
 * Eight-wind compass point
 */
export type CompassPoint = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

const COMPASS_POINTS: readonly CompassPoint[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Compass point nearest to `heading`, one of eight 45-degree wide sectors centred on N/NE/etc
 */
export const compassPointOf = (value: Heading): CompassPoint => {
	const index = Math.round(value / 45) % COMPASS_POINTS.length;
	return COMPASS_POINTS[index] ?? 'N';
};
