/**
 * Unit tests for marker styling functions
 */

import { describe, expect, it } from 'vitest';
import {
	createGenericMarker,
	getToiletMarkerStyle,
	getWaterMarkerStyle,
	type MarkerStyle,
} from '../../../../src/features/markers/styling';
import type { Element } from '../../../../src/types/overpass';

describe('getWaterMarkerStyle', () => {
	it('should return correct style for drinkable water amenity', () => {
		const element: Element = {
			type: 'node',
			id: 1,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'drinking_water' },
		};

		const style = getWaterMarkerStyle(element);

		expect(style.fillColor).toBe('#4CAF50'); // Green for drinking water
		expect(style.radius).toBe(6); // Default radius
		expect(style.fillOpacity).toBe(0.6);
		expect(style.iconType).toBe('circle');
	});

	it('should return warning color for non-drinkable water', () => {
		const element: Element = {
			type: 'node',
			id: 2,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'drinking_water', drinking_water: 'no' },
		};

		const style = getWaterMarkerStyle(element);

		expect(style.fillColor).toBe('#FF5722'); // Warning color
		expect(style.iconType).toBe('crossed');
	});

	it('should use spring color for natural springs', () => {
		const element: Element = {
			type: 'node',
			id: 3,
			lat: 56.9496,
			lon: 24.1052,
			tags: { natural: 'spring' },
		};

		const style = getWaterMarkerStyle(element);

		expect(style.fillColor).toBe('#00BCD4'); // Cyan for spring
	});

	it('should increase radius for wheelchair accessible', () => {
		const element: Element = {
			type: 'node',
			id: 4,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'drinking_water', wheelchair: 'yes' },
		};

		const style = getWaterMarkerStyle(element);

		expect(style.radius).toBe(8); // Wheelchair radius
	});

	it('should increase radius for bottle refill', () => {
		const element: Element = {
			type: 'node',
			id: 5,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'drinking_water', bottle: 'yes' },
		};

		const style = getWaterMarkerStyle(element);

		expect(style.radius).toBe(8); // Bottle radius
	});

	it('should reduce opacity for seasonal markers', () => {
		const element: Element = {
			type: 'node',
			id: 6,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'drinking_water', seasonal: 'yes' },
		};

		const style = getWaterMarkerStyle(element, { isSeasonal: true });

		expect(style.fillOpacity).toBe(0.3); // Seasonal opacity
	});

	it('should highlight nearest marker with gold color', () => {
		const element: Element = {
			type: 'node',
			id: 7,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'drinking_water' },
		};

		const style = getWaterMarkerStyle(element, { isNearest: true });

		expect(style.fillColor).toBe('#FFD700'); // Gold for nearest
		expect(style.radius).toBe(9); // Highlighted radius
	});
});

describe('getToiletMarkerStyle', () => {
	it('should return correct style for standard toilet', () => {
		const element: Element = {
			type: 'node',
			id: 1,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets' },
		};

		const style = getToiletMarkerStyle(element);

		expect(style.fillColor).toBe('#A1887F'); // Light brown for standard
		expect(style.radius).toBe(6); // Default radius
		expect(style.fillOpacity).toBe(0.7);
		expect(style.iconType).toBe('circle');
	});

	it('should use accessible color for wheelchair toilets', () => {
		const element: Element = {
			type: 'node',
			id: 2,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets', wheelchair: 'yes' },
		};

		const style = getToiletMarkerStyle(element);

		expect(style.fillColor).toBe('#8D6E63'); // Darker brown for accessible
		expect(style.radius).toBe(8); // Wheelchair radius
	});

	it('should use premium color for paid toilets', () => {
		const element: Element = {
			type: 'node',
			id: 3,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets', fee: 'yes' },
		};

		const style = getToiletMarkerStyle(element);

		expect(style.fillColor).toBe('#6D4C41'); // Dark brown for premium/paid
	});

	it('should highlight nearest toilet with gold color', () => {
		const element: Element = {
			type: 'node',
			id: 4,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets' },
		};

		const style = getToiletMarkerStyle(element, { isNearest: true });

		expect(style.fillColor).toBe('#FFD700'); // Gold for nearest
		expect(style.radius).toBe(9); // Highlighted radius
	});

	it('should prioritize accessible over paid for styling', () => {
		const element: Element = {
			type: 'node',
			id: 5,
			lat: 56.9496,
			lon: 24.1052,
			tags: { amenity: 'toilets', wheelchair: 'yes', fee: 'yes' },
		};

		const style = getToiletMarkerStyle(element);

		// Accessible color takes precedence
		expect(style.fillColor).toBe('#8D6E63');
	});
});

describe('createGenericMarker', () => {
	it('should create a circle marker with provided style', () => {
		const style: MarkerStyle = {
			color: '#333',
			fillColor: '#4CAF50',
			radius: 6,
			weight: 2,
			fillOpacity: 0.6,
			iconType: 'circle',
		};

		const marker = createGenericMarker(56.9496, 24.1052, style);

		expect(marker).toBeDefined();
		expect(marker.getLatLng().lat).toBe(56.9496);
		expect(marker.getLatLng().lng).toBe(24.1052);
	});

	it('should create a crossed-out marker for non-drinkable water', () => {
		const style: MarkerStyle = {
			color: '#333',
			fillColor: '#FF5722',
			radius: 8,
			weight: 2,
			fillOpacity: 0.6,
			iconType: 'crossed',
		};

		const marker = createGenericMarker(56.9496, 24.1052, style);

		expect(marker).toBeDefined();
		// For crossed markers, it returns a regular Marker with divIcon
		expect(marker.getLatLng().lat).toBe(56.9496);
	});

	it('should handle custom icon type', () => {
		const style: MarkerStyle = {
			color: '#333',
			fillColor: '#795548',
			radius: 6,
			weight: 2,
			fillOpacity: 0.6,
			iconType: 'custom',
		};

		const marker = createGenericMarker(56.9496, 24.1052, style);

		expect(marker).toBeDefined();
	});
});
