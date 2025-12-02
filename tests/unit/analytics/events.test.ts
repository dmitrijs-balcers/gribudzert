/**
 * Analytics Events Tests
 *
 * Tests for all event tracking functions.
 * Each test verifies the event is tracked with correct name and data.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	trackAreaExplored,
	trackEmptyArea,
	trackLayerDisabled,
	trackLayerEnabled,
	trackLocateFailed,
	trackLocateRequested,
	trackLocateSuccess,
	trackMapLoaded,
	trackMarkerClicked,
	trackNavigationStarted,
} from '../../../src/analytics/events';
import type { UmamiTracker } from '../../../src/analytics/types';

describe('Analytics Events', () => {
	let mockTrack: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockTrack = vi.fn();
		(window as Window & { umami?: UmamiTracker }).umami = { track: mockTrack };

		// Ensure DNT is off for tests
		Object.defineProperty(navigator, 'doNotTrack', {
			value: null,
			writable: true,
			configurable: true,
		});
	});

	afterEach(() => {
		(window as Window & { umami?: UmamiTracker }).umami = undefined;
		vi.clearAllMocks();
	});

	// =============================================================================
	// Map Engagement Events (P1) - User Story 1
	// =============================================================================

	describe('trackMapLoaded', () => {
		it('should track map_loaded event with user location type', () => {
			trackMapLoaded('user');
			expect(mockTrack).toHaveBeenCalledWith('map_loaded', { location_type: 'user' });
		});

		it('should track map_loaded event with default location type', () => {
			trackMapLoaded('default');
			expect(mockTrack).toHaveBeenCalledWith('map_loaded', { location_type: 'default' });
		});

		it('should not throw when Umami is unavailable', () => {
			(window as Window & { umami?: UmamiTracker }).umami = undefined;
			expect(() => trackMapLoaded('user')).not.toThrow();
		});
	});

	describe('trackMarkerClicked', () => {
		it('should track marker_clicked event with water facility type', () => {
			trackMarkerClicked('water');
			expect(mockTrack).toHaveBeenCalledWith('marker_clicked', { facility_type: 'water' });
		});

		it('should track marker_clicked event with toilet facility type', () => {
			trackMarkerClicked('toilet');
			expect(mockTrack).toHaveBeenCalledWith('marker_clicked', { facility_type: 'toilet' });
		});

		it('should not throw when Umami is unavailable', () => {
			(window as Window & { umami?: UmamiTracker }).umami = undefined;
			expect(() => trackMarkerClicked('water')).not.toThrow();
		});
	});

	describe('trackNavigationStarted', () => {
		it('should track navigation_started event with water facility type', () => {
			trackNavigationStarted('water');
			expect(mockTrack).toHaveBeenCalledWith('navigation_started', { facility_type: 'water' });
		});

		it('should track navigation_started event with toilet facility type', () => {
			trackNavigationStarted('toilet');
			expect(mockTrack).toHaveBeenCalledWith('navigation_started', { facility_type: 'toilet' });
		});

		it('should not throw when Umami is unavailable', () => {
			(window as Window & { umami?: UmamiTracker }).umami = undefined;
			expect(() => trackNavigationStarted('water')).not.toThrow();
		});
	});

	// =============================================================================
	// Layer Events (P2) - User Story 2
	// =============================================================================

	describe('trackLayerEnabled', () => {
		it('should track layer_enabled event with Drinking Points', () => {
			trackLayerEnabled('Drinking Points', 2);
			expect(mockTrack).toHaveBeenCalledWith('layer_enabled', {
				layer_name: 'Drinking Points',
				active_count: 2,
			});
		});

		it('should track layer_enabled event with Public Toilets', () => {
			trackLayerEnabled('Public Toilets', 1);
			expect(mockTrack).toHaveBeenCalledWith('layer_enabled', {
				layer_name: 'Public Toilets',
				active_count: 1,
			});
		});

		it('should not throw when Umami is unavailable', () => {
			(window as Window & { umami?: UmamiTracker }).umami = undefined;
			expect(() => trackLayerEnabled('Drinking Points', 1)).not.toThrow();
		});
	});

	describe('trackLayerDisabled', () => {
		it('should track layer_disabled event with layer name and count', () => {
			trackLayerDisabled('Public Toilets', 1);
			expect(mockTrack).toHaveBeenCalledWith('layer_disabled', {
				layer_name: 'Public Toilets',
				active_count: 1,
			});
		});

		it('should not throw when Umami is unavailable', () => {
			(window as Window & { umami?: UmamiTracker }).umami = undefined;
			expect(() => trackLayerDisabled('Drinking Points', 0)).not.toThrow();
		});
	});

	// =============================================================================
	// Location Events (P2) - User Story 3
	// =============================================================================

	describe('trackLocateRequested', () => {
		it('should track locate_requested event', () => {
			trackLocateRequested();
			expect(mockTrack).toHaveBeenCalledWith('locate_requested');
		});

		it('should not throw when Umami is unavailable', () => {
			(window as Window & { umami?: UmamiTracker }).umami = undefined;
			expect(() => trackLocateRequested()).not.toThrow();
		});
	});

	describe('trackLocateSuccess', () => {
		it('should track locate_success event', () => {
			trackLocateSuccess();
			expect(mockTrack).toHaveBeenCalledWith('locate_success');
		});

		it('should not throw when Umami is unavailable', () => {
			(window as Window & { umami?: UmamiTracker }).umami = undefined;
			expect(() => trackLocateSuccess()).not.toThrow();
		});
	});

	describe('trackLocateFailed', () => {
		it('should track locate_failed event with permission_denied reason', () => {
			trackLocateFailed('permission_denied');
			expect(mockTrack).toHaveBeenCalledWith('locate_failed', { reason: 'permission_denied' });
		});

		it('should track locate_failed event with position_unavailable reason', () => {
			trackLocateFailed('position_unavailable');
			expect(mockTrack).toHaveBeenCalledWith('locate_failed', { reason: 'position_unavailable' });
		});

		it('should track locate_failed event with timeout reason', () => {
			trackLocateFailed('timeout');
			expect(mockTrack).toHaveBeenCalledWith('locate_failed', { reason: 'timeout' });
		});

		it('should track locate_failed event with not_supported reason', () => {
			trackLocateFailed('not_supported');
			expect(mockTrack).toHaveBeenCalledWith('locate_failed', { reason: 'not_supported' });
		});

		it('should track locate_failed event with insecure_context reason', () => {
			trackLocateFailed('insecure_context');
			expect(mockTrack).toHaveBeenCalledWith('locate_failed', { reason: 'insecure_context' });
		});

		it('should not throw when Umami is unavailable', () => {
			(window as Window & { umami?: UmamiTracker }).umami = undefined;
			expect(() => trackLocateFailed('permission_denied')).not.toThrow();
		});
	});

	// =============================================================================
	// Exploration Events (P3) - User Story 4
	// =============================================================================

	describe('trackAreaExplored', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
			trackAreaExplored.cancel();
		});

		it('should track area_explored event after debounce delay', () => {
			trackAreaExplored();
			expect(mockTrack).not.toHaveBeenCalled();

			vi.advanceTimersByTime(2000);
			expect(mockTrack).toHaveBeenCalledWith('area_explored');
		});

		it('should only fire once for multiple rapid calls', () => {
			trackAreaExplored();
			trackAreaExplored();
			trackAreaExplored();

			vi.advanceTimersByTime(2000);
			expect(mockTrack).toHaveBeenCalledTimes(1);
		});

		it('should reset debounce timer on subsequent calls', () => {
			trackAreaExplored();
			vi.advanceTimersByTime(1000);
			trackAreaExplored();
			vi.advanceTimersByTime(1000);
			expect(mockTrack).not.toHaveBeenCalled();

			vi.advanceTimersByTime(1000);
			expect(mockTrack).toHaveBeenCalledTimes(1);
		});

		it('should have cancel method that prevents tracking', () => {
			trackAreaExplored();
			trackAreaExplored.cancel();

			vi.advanceTimersByTime(2000);
			expect(mockTrack).not.toHaveBeenCalled();
		});

		it('should not throw when Umami is unavailable', () => {
			(window as Window & { umami?: UmamiTracker }).umami = undefined;
			expect(() => trackAreaExplored()).not.toThrow();
			vi.advanceTimersByTime(2000);
		});
	});

	describe('trackEmptyArea', () => {
		it('should track empty_area event with water facility type', () => {
			trackEmptyArea('water');
			expect(mockTrack).toHaveBeenCalledWith('empty_area', { facility_type: 'water' });
		});

		it('should track empty_area event with toilet facility type', () => {
			trackEmptyArea('toilet');
			expect(mockTrack).toHaveBeenCalledWith('empty_area', { facility_type: 'toilet' });
		});

		it('should not throw when Umami is unavailable', () => {
			(window as Window & { umami?: UmamiTracker }).umami = undefined;
			expect(() => trackEmptyArea('water')).not.toThrow();
		});
	});
});
