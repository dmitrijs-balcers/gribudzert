/**
 * Global test setup for Vitest
 * Runs before all test files
 */

import { beforeAll, afterEach, vi } from 'vitest';

// Mock Leaflet to avoid requiring DOM elements
vi.mock('leaflet', () => ({
	default: {
		map: vi.fn(),
		tileLayer: vi.fn(),
		circleMarker: vi.fn(),
		featureGroup: vi.fn(),
		control: {
			locate: vi.fn(),
		},
	},
	map: vi.fn(),
	tileLayer: vi.fn(),
	circleMarker: vi.fn(),
	featureGroup: vi.fn(),
}));

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
