/**
 * Test utilities and mock factories
 */

import type { OsmNode } from '../src/types/overpass';

/**
 * Create a mock OSM node for testing
 */
export function createMockOsmNode(overrides?: Partial<OsmNode>): OsmNode {
	return {
		id: 123456,
		lat: 56.95,
		lon: 24.1,
		tags: {
			amenity: 'drinking_water',
			name: 'Test Water Point',
		},
		...overrides,
	};
}

/**
 * Create multiple mock OSM nodes
 */
export function createMockOsmNodes(count: number): OsmNode[] {
	return Array.from({ length: count }, (_, i) =>
		createMockOsmNode({
			id: 100000 + i,
			lat: 56.95 + i * 0.01,
			lon: 24.1 + i * 0.01,
			tags: {
				amenity: 'drinking_water',
				name: `Test Water Point ${i + 1}`,
			},
		})
	);
}

/**
 * Create a mock XML document for Overpass API response
 */
export function createMockOverpassXml(nodes: OsmNode[]): string {
	const nodeElements = nodes
		.map(
			(node) => `
    <node id="${node.id}" lat="${node.lat}" lon="${node.lon}">
      ${Object.entries(node.tags || {})
				.map(([k, v]) => `<tag k="${k}" v="${v}"/>`)
				.join('\n      ')}
    </node>
  `
		)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  ${nodeElements}
</osm>`;
}

/**
 * Create a mock fetch response
 */
export function createMockFetchResponse(body: string, options?: Partial<Response>): Response {
	return {
		ok: true,
		status: 200,
		statusText: 'OK',
		text: async () => body,
		json: async () => JSON.parse(body),
		...options,
	} as Response;
}

/**
 * Create a mock geolocation position
 */
export function createMockPosition(lat: number = 56.95, lon: number = 24.1): GeolocationPosition {
	return {
		coords: {
			latitude: lat,
			longitude: lon,
			accuracy: 10,
			altitude: null,
			altitudeAccuracy: null,
			heading: null,
			speed: null,
		},
		timestamp: Date.now(),
	};
}

/**
 * Wait for the next tick (useful for async operations)
 */
export function nextTick(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Wait for a specific condition to be true
 */
export async function waitFor(
	condition: () => boolean,
	timeout: number = 1000,
	interval: number = 50
): Promise<void> {
	const startTime = Date.now();
	while (!condition()) {
		if (Date.now() - startTime > timeout) {
			throw new Error('Timeout waiting for condition');
		}
		await new Promise((resolve) => setTimeout(resolve, interval));
	}
}
