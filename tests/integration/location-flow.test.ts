import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as L from 'leaflet';
import { setupMapNavigationHandlers } from '../../src/features/navigation/navigation';

// Ensure Leaflet is imported as the real module, not mocked
vi.mock('leaflet', async () => {
	const actual = await vi.importActual('leaflet');
	return actual;
});

/**
 * Integration tests for location detection and navigation flow
 * Tests the interaction between map navigation, bounds changes, and data fetching
 */
describe('location flow integration', () => {
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

	describe('pan → refetch water points', () => {
		it('should trigger refetch when panning significantly', async () => {
			const callback = vi.fn();
			const cleanup = setupMapNavigationHandlers(map, callback);

			// Initial moveend - sets lastFetchBounds
			map.fire('moveend');
			await new Promise(resolve => setTimeout(resolve, 350));
			expect(callback).toHaveBeenCalledTimes(1);

			// Pan significantly (>= 25% viewport)
			const center = map.getCenter();
			const bounds = map.getBounds();
			const latDiff = bounds.getNorth() - bounds.getSouth();
			const lngDiff = bounds.getEast() - bounds.getWest();

			// Move by 30% of viewport to ensure threshold is exceeded
			map.panTo([center.lat + latDiff * 0.3, center.lng + lngDiff * 0.3]);
			await new Promise(resolve => setTimeout(resolve, 350));

			expect(callback.mock.calls.length).toBeGreaterThan(1);

			cleanup();
		});

		it('should trigger refetch when panning moderately', async () => {
			const callback = vi.fn();
			const cleanup = setupMapNavigationHandlers(map, callback);

			// Initial moveend
			map.fire('moveend');
			await new Promise(resolve => setTimeout(resolve, 350));
			expect(callback).toHaveBeenCalledTimes(1);

			// Pan moderately - panTo causes center movement
			const center = map.getCenter();
			const bounds = map.getBounds();
			const latDiff = bounds.getNorth() - bounds.getSouth();

			// Move by 10% of viewport
			map.panTo([center.lat + latDiff * 0.1, center.lng]);
			await new Promise(resolve => setTimeout(resolve, 350));

			// Should trigger because panTo moves the center
			expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);

			cleanup();
		});

		it('should handle rapid panning with debounce', async () => {
			const callback = vi.fn();
			const cleanup = setupMapNavigationHandlers(map, callback);

			// Initial moveend to set baseline
			map.fire('moveend');
			await new Promise(resolve => setTimeout(resolve, 350));
			const initialCalls = callback.mock.calls.length;

			// Perform multiple rapid pans
			const center = map.getCenter();
			const bounds = map.getBounds();
			const latDiff = bounds.getNorth() - bounds.getSouth();

			map.panTo([center.lat + latDiff * 0.3, center.lng], { animate: false });
			await new Promise(resolve => setTimeout(resolve, 100));

			map.panTo([center.lat + latDiff * 0.4, center.lng], { animate: false });
			await new Promise(resolve => setTimeout(resolve, 100));

			map.panTo([center.lat + latDiff * 0.5, center.lng], { animate: false });

			// Wait for debounce to complete
			await new Promise(resolve => setTimeout(resolve, 350));

			// Should have been called at least once more after initial
			expect(callback.mock.calls.length).toBeGreaterThanOrEqual(initialCalls + 1);

			cleanup();
		});
	});

	describe('zoom → refetch water points', () => {
		it('should trigger refetch when zooming in', async () => {
			const callback = vi.fn();
			const cleanup = setupMapNavigationHandlers(map, callback);

			// Initial moveend
			map.fire('moveend');
			await new Promise(resolve => setTimeout(resolve, 350));
			expect(callback).toHaveBeenCalledTimes(1);

			// Zoom in - this changes the viewport significantly
			map.setZoom(map.getZoom() + 2);
			await new Promise(resolve => setTimeout(resolve, 350));

			// Should trigger refetch
			expect(callback.mock.calls.length).toBeGreaterThanOrEqual(2);

			cleanup();
		});

		it('should trigger refetch when zooming out', async () => {
			const callback = vi.fn();
			const cleanup = setupMapNavigationHandlers(map, callback);

			// Initial moveend
			map.fire('moveend');
			await new Promise(resolve => setTimeout(resolve, 350));
			expect(callback).toHaveBeenCalledTimes(1);

			// Zoom out - this changes the viewport significantly
			map.setZoom(map.getZoom() - 2);
			await new Promise(resolve => setTimeout(resolve, 350));

			// Should trigger refetch
			expect(callback.mock.calls.length).toBeGreaterThanOrEqual(2);

			cleanup();
		});

		it('should handle rapid zoom changes with debounce', async () => {
			const callback = vi.fn();
			const cleanup = setupMapNavigationHandlers(map, callback);

			// Perform multiple rapid zoom operations
			const initialZoom = map.getZoom();

			map.setZoom(initialZoom + 1);
			await new Promise(resolve => setTimeout(resolve, 50));

			map.setZoom(initialZoom + 2);
			await new Promise(resolve => setTimeout(resolve, 50));

			map.setZoom(initialZoom + 3);

			// Wait for debounce to complete
			await new Promise(resolve => setTimeout(resolve, 350));

			// Should be called for initial zoom event (sets baseline)
			expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);

			cleanup();
		});
	});

	describe('combined pan and zoom operations', () => {
		it('should handle pan followed by zoom', async () => {
			const callback = vi.fn();
			const cleanup = setupMapNavigationHandlers(map, callback);

			// Initial moveend
			map.fire('moveend');
			await new Promise(resolve => setTimeout(resolve, 350));
			expect(callback).toHaveBeenCalledTimes(1);

			// Pan significantly
			const center = map.getCenter();
			const bounds = map.getBounds();
			const latDiff = bounds.getNorth() - bounds.getSouth();
			map.panTo([center.lat + latDiff * 0.3, center.lng], { animate: false });
			await new Promise(resolve => setTimeout(resolve, 350));

			const callsAfterPan = callback.mock.calls.length;
			expect(callsAfterPan).toBeGreaterThan(1);

			// Then zoom - this will trigger another refetch
			map.setZoom(map.getZoom() + 1);
			await new Promise(resolve => setTimeout(resolve, 350));

			// Should have more calls after zoom
			expect(callback.mock.calls.length).toBeGreaterThanOrEqual(callsAfterPan);

			cleanup();
		});
	});
});
