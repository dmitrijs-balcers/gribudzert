import { haversineDistance } from '../utils/geometry';

export type Latitude = number & { readonly __brand: 'Latitude' };

export type Longitude = number & { readonly __brand: 'Longitude' };

export type Coordinates = {
	readonly lat: Latitude;
	readonly lon: Longitude;
};

export type LatLon = {
	readonly lat: number;
	readonly lon: number;
};

export type Meters = number & { readonly __brand: 'Meters' };

export const latitude = (value: number): Latitude | null => {
	if (!Number.isFinite(value) || value < -90 || value > 90) {
		return null;
	}
	return value as Latitude;
};

export const longitude = (value: number): Longitude | null => {
	if (!Number.isFinite(value) || value < -180 || value > 180) {
		return null;
	}
	return value as Longitude;
};

export const coordinates = (lat: number, lon: number): Coordinates | null => {
	const validLat = latitude(lat);
	const validLon = longitude(lon);

	if (validLat === null || validLon === null) {
		return null;
	}

	return { lat: validLat, lon: validLon };
};

export const meters = (value: number): Meters | null => {
	if (!Number.isFinite(value) || value < 0) {
		return null;
	}
	return value as Meters;
};

type IsNumberLiteral<N extends number> = number extends N ? false : true;

type NonNegativeNumberLiteral<N extends number> = IsNumberLiteral<N> extends true
	? `${N}` extends `-${string}`
		? never
		: N
	: never;

export const metersLiteral = <N extends number>(value: NonNegativeNumberLiteral<N>): Meters =>
	value as unknown as Meters;

export const distanceBetween = (from: LatLon, to: LatLon): Meters => {
	return haversineDistance(from.lat, from.lon, to.lat, to.lon) as Meters;
};

export const formatDistance = (distance: Meters): string => {
	if (distance < 1000) {
		return `${Math.round(distance)}m`;
	}
	return `${(distance / 1000).toFixed(2)}km`;
};

export type Heading = number & { readonly __brand: 'Heading' };

export type MetersPerSecond = number & { readonly __brand: 'MetersPerSecond' };

export const heading = (value: number): Heading | null => {
	if (!Number.isFinite(value) || value < 0 || value >= 360) {
		return null;
	}
	return value as Heading;
};

export const metersPerSecond = (value: number): MetersPerSecond | null => {
	if (!Number.isFinite(value) || value < 0) {
		return null;
	}
	return value as MetersPerSecond;
};

export const metersPerSecondLiteral = <N extends number>(
	value: NonNegativeNumberLiteral<N>
): MetersPerSecond => value as unknown as MetersPerSecond;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

const normalizeDegrees = (value: number): number => ((value % 360) + 360) % 360;

export const bearingBetween = (from: LatLon, to: LatLon): Heading => {
	const fromLat = toRadians(from.lat);
	const toLat = toRadians(to.lat);
	const deltaLon = toRadians(to.lon - from.lon);

	const y = Math.sin(deltaLon) * Math.cos(toLat);
	const x =
		Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon);

	return normalizeDegrees(toDegrees(Math.atan2(y, x))) as Heading;
};

export type CompassPoint = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

const COMPASS_POINTS: readonly CompassPoint[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const compassPointOf = (value: Heading): CompassPoint => {
	const index = Math.round(value / 45) % COMPASS_POINTS.length;
	return COMPASS_POINTS[index] ?? 'N';
};
