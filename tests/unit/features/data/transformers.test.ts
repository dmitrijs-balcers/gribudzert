/**
 * Unit tests for data transformers
 * Tests transformation of Overpass elements to Facility types
 */

import { describe, expect, it } from 'vitest';
import {
	elementToToiletFacility,
	elementToWaterFacility,
	isAccessible,
} from '../../../../src/features/data/transformers';
import type { Element } from '../../../../src/types/overpass';

describe('elementToWaterFacility', () => {
	it('should transform drinking_water amenity to WaterFacility', () => {
		const element: Element = {
			type: 'node',
			id: 1,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'drinking_water' },
		};

		const facility = elementToWaterFacility(element);

		expect(facility.kind).toBe('water');
		expect(facility.element).toBe(element);
		expect(facility.drinkable).toBe(true);
		expect(facility.sourceType).toBe('drinking_water');
	});

	it('should handle non-drinkable water', () => {
		const element: Element = {
			type: 'node',
			id: 2,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'drinking_water', drinking_water: 'no' },
		};

		const facility = elementToWaterFacility(element);

		expect(facility.drinkable).toBe(false);
	});

	it('should identify spring as water source type', () => {
		const element: Element = {
			type: 'node',
			id: 3,
			lat: 56.9496,
			lon: 24.1052,
			tags: { natural: 'spring' },
		};

		const facility = elementToWaterFacility(element);

		expect(facility.sourceType).toBe('spring');
		expect(facility.drinkable).toBe(true);
	});

	it('should handle unknown water source type', () => {
		const element: Element = {
			type: 'node',
			id: 4,
			lat: 56.9496,
			lon: 24.1052,
			tags: {},
		};

		const facility = elementToWaterFacility(element);

		expect(facility.sourceType).toBe('unknown');
	});
});

describe('elementToToiletFacility', () => {
	it('should transform toilet amenity to ToiletFacility', () => {
		const element: Element = {
			type: 'node',
			id: 1,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets' },
		};

		const facility = elementToToiletFacility(element);

		expect(facility.kind).toBe('toilet');
		expect(facility.element).toBe(element);
		expect(facility.accessibility.wheelchair).toBe('unknown');
		expect(facility.accessibility.changingTable).toBe('unknown');
		expect(facility.details.fee).toBe('unknown');
		expect(facility.details.openingHours).toBeNull();
		expect(facility.details.unisex).toBeNull();
	});

	it('should parse wheelchair accessibility correctly', () => {
		const element: Element = {
			type: 'node',
			id: 2,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets', wheelchair: 'yes' },
		};

		const facility = elementToToiletFacility(element);

		expect(facility.accessibility.wheelchair).toBe('yes');
	});

	it('should parse limited wheelchair access', () => {
		const element: Element = {
			type: 'node',
			id: 3,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets', wheelchair: 'limited' },
		};

		const facility = elementToToiletFacility(element);

		expect(facility.accessibility.wheelchair).toBe('limited');
	});

	it('should parse changing table availability', () => {
		const element: Element = {
			type: 'node',
			id: 4,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets', changing_table: 'yes' },
		};

		const facility = elementToToiletFacility(element);

		expect(facility.accessibility.changingTable).toBe('yes');
	});

	it('should parse fee status', () => {
		const element: Element = {
			type: 'node',
			id: 5,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets', fee: 'yes' },
		};

		const facility = elementToToiletFacility(element);

		expect(facility.details.fee).toBe('yes');
	});

	it('should parse opening hours', () => {
		const element: Element = {
			type: 'node',
			id: 6,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets', opening_hours: 'Mo-Fr 08:00-20:00' },
		};

		const facility = elementToToiletFacility(element);

		expect(facility.details.openingHours).toBe('Mo-Fr 08:00-20:00');
	});

	it('should parse unisex tag', () => {
		const element: Element = {
			type: 'node',
			id: 7,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets', unisex: 'yes' },
		};

		const facility = elementToToiletFacility(element);

		expect(facility.details.unisex).toBe(true);
	});

	it('should handle fully specified toilet', () => {
		const element: Element = {
			type: 'node',
			id: 8,
			lat: 56.9496,
			lon: 24.1052,
			tags: {
				amenity: 'toilets',
				wheelchair: 'yes',
				changing_table: 'yes',
				fee: 'no',
				opening_hours: '24/7',
				unisex: 'yes',
			},
		};

		const facility = elementToToiletFacility(element);

		expect(facility.accessibility.wheelchair).toBe('yes');
		expect(facility.accessibility.changingTable).toBe('yes');
		expect(facility.details.fee).toBe('no');
		expect(facility.details.openingHours).toBe('24/7');
		expect(facility.details.unisex).toBe(true);
	});
});

describe('isAccessible', () => {
	it('should return true for wheelchair=yes', () => {
		const element: Element = {
			type: 'node',
			id: 1,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets', wheelchair: 'yes' },
		};

		const facility = elementToToiletFacility(element);
		expect(isAccessible(facility)).toBe(true);
	});

	it('should return false for wheelchair=no', () => {
		const element: Element = {
			type: 'node',
			id: 2,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets', wheelchair: 'no' },
		};

		const facility = elementToToiletFacility(element);
		expect(isAccessible(facility)).toBe(false);
	});

	it('should return false for wheelchair=limited', () => {
		const element: Element = {
			type: 'node',
			id: 3,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets', wheelchair: 'limited' },
		};

		const facility = elementToToiletFacility(element);
		expect(isAccessible(facility)).toBe(false);
	});

	it('should return false for wheelchair=unknown', () => {
		const element: Element = {
			type: 'node',
			id: 4,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets' },
		};

		const facility = elementToToiletFacility(element);
		expect(isAccessible(facility)).toBe(false);
	});
});
