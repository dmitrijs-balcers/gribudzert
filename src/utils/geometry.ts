/**
 * Geometry utilities for distance calculations
 */

import type { Element } from '../types/overpass';

/**
 * Calculate distance between two geographic points using Haversine formula
 * @param lat1 - Latitude of first point in decimal degrees
 * @param lon1 - Longitude of first point in decimal degrees
 * @param lat2 - Latitude of second point in decimal degrees
 * @param lon2 - Longitude of second point in decimal degrees
 * @returns Distance in meters
 */
export function haversineDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const R = 6371e3; // Earth radius in meters
	const φ1 = (lat1 * Math.PI) / 180;
	const φ2 = (lat2 * Math.PI) / 180;
	const Δφ = ((lat2 - lat1) * Math.PI) / 180;
	const Δλ = ((lon2 - lon1) * Math.PI) / 180;

	const a =
		Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
		Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c; // Distance in meters
}

/**
 * Find the nearest water point to a given location
 * @param userLat - User's latitude in decimal degrees
 * @param userLon - User's longitude in decimal degrees
 * @param points - Array of water point elements
 * @returns Nearest element or null if array is empty
 */
export function findNearestWaterPoint(
	userLat: number,
	userLon: number,
	points: readonly Element[]
): Element | null {
	if (points.length === 0) {
		return null;
	}

	return points.reduce((nearest, point) => {
		const distToPoint = haversineDistance(userLat, userLon, point.lat, point.lon);
		const distToNearest = haversineDistance(userLat, userLon, nearest.lat, nearest.lon);
		return distToPoint < distToNearest ? point : nearest;
	});
}

