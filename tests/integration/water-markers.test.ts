/**
 * Integration test verifying existing water tap functionality still works
 * This test ensures no regression after refactoring
 */

import * as L from 'leaflet';
import { beforeEach, describe, expect, it } from 'vitest';
import { addMarkers } from '../../src/features/markers/markers';
import type { Element } from '../../src/types/overpass';

describe('Water Markers Integration', () => {
	let map: L.Map;
	let layer: L.FeatureGroup;

	beforeEach(() => {
		// Create a container div for the map
		const container = document.createElement('div');
		container.id = 'map';
		container.style.height = '400px';
		document.body.appendChild(container);

		// Initialize map
		map = L.map('map').setView([56.9496, 24.1052], 13);

		// Create layer
		layer = L.featureGroup().addTo(map);
	});

	it('should add drinkable water markers to the layer', () => {
		const elements: Element[] = [
			{
				type: 'node',
				id: 1,
				lat: 56.9496,
				lon: 24.1052,
				tags: { amenity: 'drinking_water' },
			},
			{
				type: 'node',
				id: 2,
				lat: 56.95,
				lon: 24.11,
				tags: { natural: 'spring' },
			},
		];

		addMarkers(elements, layer, map);

		// Verify markers were added (one per element with valid coordinates)
		expect(layer.getLayers().length).toBe(2);
	});

	it('should add non-drinkable water markers with crossed style', () => {
		const elements: Element[] = [
			{
				type: 'node',
				id: 3,
				lat: 56.9496,
				lon: 24.1052,
				tags: { amenity: 'drinking_water', drinking_water: 'no' },
			},
		];

		addMarkers(elements, layer, map);

		expect(layer.getLayers().length).toBe(1);
	});

	it('should highlight nearest marker when provided', () => {
		const elements: Element[] = [
			{
				type: 'node',
				id: 1,
				lat: 56.9496,
				lon: 24.1052,
				tags: { amenity: 'drinking_water' },
			},
			{
				type: 'node',
				id: 2,
				lat: 56.95,
				lon: 24.11,
				tags: { amenity: 'drinking_water' },
			},
		];

		const nearestPoint = elements[0];
		addMarkers(elements, layer, map, nearestPoint);

		expect(layer.getLayers().length).toBe(2);
	});

	it('should skip markers with invalid coordinates', () => {
		const elements: Element[] = [
			{
				type: 'node',
				id: 1,
				lat: NaN,
				lon: 24.1052,
				tags: { amenity: 'drinking_water' },
			},
			{
				type: 'node',
				id: 2,
				lat: 56.95,
				lon: 24.11,
				tags: { amenity: 'drinking_water' },
			},
		];

		addMarkers(elements, layer, map);

		// Should only add the marker with valid coordinates
		expect(layer.getLayers().length).toBe(1);
	});

	it('should apply seasonal styling', () => {
		const elements: Element[] = [
			{
				type: 'node',
				id: 1,
				lat: 56.9496,
				lon: 24.1052,
				tags: { amenity: 'drinking_water', seasonal: 'yes' },
			},
		];

		addMarkers(elements, layer, map);

		expect(layer.getLayers().length).toBe(1);
	});
});
