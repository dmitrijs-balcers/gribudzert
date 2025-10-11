/**
 * Tests for geometry utility functions
 */

import { describe, it, expect } from 'vitest';
import { haversineDistance, findNearestWaterPoint } from '../../../src/utils/geometry';
import type { Element } from '../../../src/types/overpass';

describe('haversineDistance', () => {
	it('should return 0 for the same point', () => {
		const distance = haversineDistance(56.9496, 24.1052, 56.9496, 24.1052);
		expect(distance).toBe(0);
	});

	it('should calculate known distance between Riga and Jurmala (approx 20km)', () => {
		const rigaLat = 56.9496;
		const rigaLon = 24.1052;
		const jurmalaLat = 56.948;
		const jurmalaLon = 23.6164;

		const distance = haversineDistance(rigaLat, rigaLon, jurmalaLat, jurmalaLon);

		// Distance should be approximately 29-30km
		expect(distance).toBeGreaterThan(29000);
		expect(distance).toBeLessThan(31000);
	});

	it('should calculate distance between close points (100m)', () => {
		const lat1 = 56.9496;
		const lon1 = 24.1052;
		// Move approximately 100m north
		const lat2 = 56.9496 + 0.0009;
		const lon2 = 24.1052;

		const distance = haversineDistance(lat1, lon1, lat2, lon2);

		// Should be approximately 100m (within 10% tolerance)
		expect(distance).toBeGreaterThan(90);
		expect(distance).toBeLessThan(110);
	});

	it('should handle negative coordinates (Southern/Western hemispheres)', () => {
		const distance = haversineDistance(-33.8688, 151.2093, -33.9249, 151.1945);
		// Sydney distance should be positive
		expect(distance).toBeGreaterThan(0);
	});

	it('should be symmetric (distance A→B equals B→A)', () => {
		const distanceAB = haversineDistance(56.9496, 24.1052, 57.0, 24.2);
		const distanceBA = haversineDistance(57.0, 24.2, 56.9496, 24.1052);

		expect(distanceAB).toBe(distanceBA);
	});
});

describe('findNearestWaterPoint', () => {
	it('should return null for empty array', () => {
		const nearest = findNearestWaterPoint(56.9496, 24.1052, []);
		expect(nearest).toBeNull();
	});

	it('should return the only point when array has one element', () => {
		const singlePoint: Element = {
			type: 'node',
			id: 1,
			lat: 56.95,
			lon: 24.11,
			tags: { amenity: 'drinking_water' },
		};

		const nearest = findNearestWaterPoint(56.9496, 24.1052, [singlePoint]);
		expect(nearest).toBe(singlePoint);
	});

	it('should find the nearest point among multiple options', () => {
		const userLat = 56.9496;
		const userLon = 24.1052;

		const nearPoint: Element = {
			type: 'node',
			id: 1,
			lat: 56.95,
			lon: 24.106, // Close to user
			tags: { amenity: 'drinking_water' },
		};

		const farPoint: Element = {
			type: 'node',
			id: 2,
			lat: 57.0,
			lon: 24.5, // Far from user
			tags: { amenity: 'drinking_water' },
		};

		const mediumPoint: Element = {
			type: 'node',
			id: 3,
			lat: 56.96,
			lon: 24.15,
			tags: { amenity: 'drinking_water' },
		};

		const points = [farPoint, mediumPoint, nearPoint];
		const nearest = findNearestWaterPoint(userLat, userLon, points);

		expect(nearest).toBe(nearPoint);
		expect(nearest?.id).toBe(1);
	});

	it('should handle points at equal distances', () => {
		const userLat = 56.9496;
		const userLon = 24.1052;

		// Two points equidistant from user (north and south)
		const northPoint: Element = {
			type: 'node',
			id: 1,
			lat: 56.96,
			lon: 24.1052,
			tags: { amenity: 'drinking_water' },
		};

		const southPoint: Element = {
			type: 'node',
			id: 2,
			lat: 56.94,
			lon: 24.1052,
			tags: { amenity: 'drinking_water' },
		};

		const points = [northPoint, southPoint];
		const nearest = findNearestWaterPoint(userLat, userLon, points);

		// Should return one of them (first in reduce logic)
		expect(nearest).toBeDefined();
		expect([1, 2]).toContain(nearest?.id);
	});

	it('should work with readonly array', () => {
		const points: readonly Element[] = [
			{
				type: 'node',
				id: 1,
				lat: 56.95,
				lon: 24.11,
				tags: { amenity: 'drinking_water' },
			},
		];

		const nearest = findNearestWaterPoint(56.9496, 24.1052, points);
		expect(nearest).toBeDefined();
	});
});
