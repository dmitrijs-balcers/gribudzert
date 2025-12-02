/**
 * Global test setup for Vitest
 * Runs before all test files
 */

import { afterEach, beforeAll, vi } from 'vitest';

// Mock Leaflet to avoid requiring DOM elements
vi.mock('leaflet', () => {
	const createMockMarker = () => {
		const marker = {
			addTo: vi.fn((layer) => {
				if (layer && typeof layer.addLayer === 'function') {
					layer.addLayer(marker);
				}
				return marker;
			}),
			bindPopup: vi.fn().mockReturnThis(),
			on: vi.fn().mockReturnThis(),
			getLatLng: vi.fn(() => ({ lat: 56.9496, lng: 24.1052 })),
			options: {},
		};
		return marker;
	};

	const createMockFeatureGroup = () => {
		const layers: unknown[] = [];
		return {
			addTo: vi.fn().mockReturnThis(),
			getLayers: vi.fn(() => layers),
			clearLayers: vi.fn(() => {
				layers.length = 0;
			}),
			addLayer: vi.fn((layer) => {
				layers.push(layer);
			}),
		};
	};

	const mockMap = {
		setView: vi.fn().mockReturnThis(),
		addLayer: vi.fn().mockReturnThis(),
		removeLayer: vi.fn().mockReturnThis(),
		getBounds: vi.fn(() => ({
			getSouth: () => 56.9,
			getWest: () => 24.0,
			getNorth: () => 57.0,
			getEast: () => 24.2,
		})),
		on: vi.fn().mockReturnThis(),
		getCenter: vi.fn(() => ({ lat: 56.9496, lng: 24.1052 })),
	};

	return {
		default: {
			map: vi.fn(() => mockMap),
			tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
			circleMarker: vi.fn(() => createMockMarker()),
			marker: vi.fn(() => createMockMarker()),
			featureGroup: vi.fn(() => createMockFeatureGroup()),
			divIcon: vi.fn((options) => options),
			control: {
				locate: vi.fn(),
				layers: vi.fn(),
				scale: vi.fn(() => ({ addTo: vi.fn() })),
			},
			Control: {
				extend: vi.fn((options) => () => options),
			},
			DomUtil: {
				create: vi.fn((tag, className) => {
					const el = document.createElement(tag);
					if (className) el.className = className;
					return el;
				}),
			},
			DomEvent: {
				on: vi.fn(),
			},
		},
		map: vi.fn(() => mockMap),
		tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
		circleMarker: vi.fn(() => createMockMarker()),
		marker: vi.fn(() => createMockMarker()),
		featureGroup: vi.fn(() => createMockFeatureGroup()),
		divIcon: vi.fn((options) => options),
	};
});

// Setup global test utilities
beforeAll(() => {
	// Suppress console.log during tests unless explicitly needed
	if (!process.env.DEBUG) {
		vi.spyOn(console, 'log').mockImplementation(() => {
			/* intentionally empty - suppressing console.log */
		});
	}
});

// Clean up after each test
afterEach(() => {
	vi.clearAllMocks();
});

// Mock browser APIs that may not be available in happy-dom
global.fetch = global.fetch || vi.fn();

// Mock IntersectionObserver if needed
global.IntersectionObserver =
	global.IntersectionObserver ||
	class IntersectionObserver {
		observe() {
			/* intentionally empty - mock implementation */
		}
		disconnect() {
			/* intentionally empty - mock implementation */
		}
		unobserve() {
			/* intentionally empty - mock implementation */
		}
	};
