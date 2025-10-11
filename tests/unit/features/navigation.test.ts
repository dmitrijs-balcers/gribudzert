import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as L from 'leaflet';
import { hasMovedSignificantly, setupMapNavigationHandlers } from '../../../src/features/navigation/navigation';

// Ensure Leaflet is imported as the real module, not mocked
vi.mock('leaflet', async () => {
	const actual = await vi.importActual('leaflet');
	return actual;
});

describe('navigation', () => {
	describe('hasMovedSignificantly', () => {
		it('should return false for no movement', () => {
			const bounds = L.latLngBounds(L.latLng(56.9, 24.0), L.latLng(57.0, 24.2));
			const result = hasMovedSignificantly(bounds, bounds);
			expect(result).toBe(false);
		});

		it('should return false for small movement (< 25% viewport)', () => {
			// Create bounds representing ~2km x 2km viewport
			const oldBounds = L.latLngBounds(L.latLng(56.95, 24.1), L.latLng(56.97, 24.13));
			// Move by ~200m (< 25% of diagonal)
			const newBounds = L.latLngBounds(L.latLng(56.952, 24.102), L.latLng(56.972, 24.132));
			const result = hasMovedSignificantly(oldBounds, newBounds);
			expect(result).toBe(false);
		});

		it('should return true for significant movement (>= 25% viewport)', () => {
			// Create bounds representing ~2km x 2km viewport
			const oldBounds = L.latLngBounds(L.latLng(56.95, 24.1), L.latLng(56.97, 24.13));
			// Move by ~1km (>= 25% of diagonal)
			const newBounds = L.latLngBounds(L.latLng(56.96, 24.12), L.latLng(56.98, 24.15));
			const result = hasMovedSignificantly(oldBounds, newBounds);
			expect(result).toBe(true);
		});

		it('should return true for large movement across map', () => {
			const oldBounds = L.latLngBounds(L.latLng(56.9, 24.0), L.latLng(57.0, 24.2));
			const newBounds = L.latLngBounds(L.latLng(40.7, -74.0), L.latLng(40.8, -73.9)); // NYC
			const result = hasMovedSignificantly(oldBounds, newBounds);
			expect(result).toBe(true);
		});

		it('should handle zoom in (smaller viewport)', () => {
			const oldBounds = L.latLngBounds(L.latLng(56.9, 24.0), L.latLng(57.0, 24.2));
			// Zoom in - smaller bounds around same center
			const newBounds = L.latLngBounds(L.latLng(56.94, 24.08), L.latLng(56.96, 24.12));
			const result = hasMovedSignificantly(oldBounds, newBounds);
			// Should be false as center hasn't moved significantly relative to the old viewport
			expect(result).toBe(false);
		});

		it('should handle zoom out (larger viewport)', () => {
			const oldBounds = L.latLngBounds(L.latLng(56.94, 24.08), L.latLng(56.96, 24.12));
			// Zoom out - larger bounds around same center
			const newBounds = L.latLngBounds(L.latLng(56.9, 24.0), L.latLng(57.0, 24.2));
			const result = hasMovedSignificantly(oldBounds, newBounds);
			// Should be false as center hasn't moved significantly relative to the old viewport
			expect(result).toBe(false);
		});
	});

	describe('setupMapNavigationHandlers', () => {
		let map: L.Map;
		let container: HTMLElement;

		beforeEach(() => {
			// Create a container for the map
			container = document.createElement('div');
			container.id = 'test-map';
			container.style.width = '400px';
			container.style.height = '400px';
			document.body.appendChild(container);

			// Initialize map
			map = L.map(container, {
				center: [56.95, 24.1],
				zoom: 13,
			});
		});

		afterEach(() => {
			if (map) {
				map.remove();
			}
			if (container && document.body.contains(container)) {
				document.body.removeChild(container);
			}
		});

		it('should call callback on first moveend event', async () => {
			const callback = vi.fn();
			setupMapNavigationHandlers(map, callback);

			// Trigger moveend event
			map.fire('moveend');

			// Wait for debounce
			await new Promise(resolve => setTimeout(resolve, 350));

			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith(expect.any(L.LatLngBounds));
		});

		it('should debounce multiple rapid moveend events', async () => {
			const callback = vi.fn();
			setupMapNavigationHandlers(map, callback);

			// Trigger multiple rapid events
			map.fire('moveend');
			map.fire('moveend');
			map.fire('moveend');

			// Wait less than debounce delay
			await new Promise(resolve => setTimeout(resolve, 150));
			expect(callback).not.toHaveBeenCalled();

			// Wait for debounce to complete
			await new Promise(resolve => setTimeout(resolve, 200));
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should only call callback when movement exceeds threshold', async () => {
			const callback = vi.fn();
			const cleanup = setupMapNavigationHandlers(map, callback);

			// First moveend - always triggers (sets lastFetchBounds)
			map.fire('moveend');
			await new Promise(resolve => setTimeout(resolve, 350));
			expect(callback).toHaveBeenCalledTimes(1);

			const callCountBefore = callback.mock.calls.length;

			// Large pan (>= 25% viewport) - should trigger
			map.panBy([200, 200]); // Large pixel movement
			await new Promise(resolve => setTimeout(resolve, 350));
			expect(callback.mock.calls.length).toBeGreaterThan(callCountBefore);

			cleanup();
		});

		it('should clean up event listeners on cleanup', async () => {
			const callback = vi.fn();
			const cleanup = setupMapNavigationHandlers(map, callback);

			// Verify handler works
			map.fire('moveend');
			await new Promise(resolve => setTimeout(resolve, 350));
			expect(callback).toHaveBeenCalledTimes(1);

			// Call cleanup
			cleanup();

			// Verify handler no longer works
			map.fire('moveend');
			await new Promise(resolve => setTimeout(resolve, 350));
			expect(callback).toHaveBeenCalledTimes(1); // Still 1
		});

		it('should clear pending timers on cleanup', async () => {
			const callback = vi.fn();
			const cleanup = setupMapNavigationHandlers(map, callback);

			// Trigger event
			map.fire('moveend');

			// Call cleanup before debounce completes
			cleanup();

			// Wait for what would have been the debounce delay
			await new Promise(resolve => setTimeout(resolve, 350));

			// Callback should not have been called
			expect(callback).not.toHaveBeenCalled();
		});
	});
});
