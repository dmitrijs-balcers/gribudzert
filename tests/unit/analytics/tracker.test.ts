/**
 * Analytics Tracker Tests
 *
 * Tests for core tracking functionality:
 * - isUmamiAvailable type guard
 * - respectsDoNotTrack privacy check
 * - safeTrack silent failure
 * - debounce utility
 * - isAnalyticsEnabled combined check
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AREA_EXPLORED_DEBOUNCE_MS,
	debounce,
	isAnalyticsEnabled,
	isUmamiAvailable,
	respectsDoNotTrack,
	safeTrack,
} from '../../../src/analytics/tracker';
import type { UmamiTracker } from '../../../src/analytics/types';

describe('isUmamiAvailable', () => {
	it('should return true for valid UmamiTracker object', () => {
		const validTracker: UmamiTracker = {
			track: vi.fn(),
		};
		expect(isUmamiAvailable(validTracker)).toBe(true);
	});

	it('should return false for null', () => {
		expect(isUmamiAvailable(null)).toBe(false);
	});

	it('should return false for undefined', () => {
		expect(isUmamiAvailable(undefined)).toBe(false);
	});

	it('should return false for non-object', () => {
		expect(isUmamiAvailable('string')).toBe(false);
		expect(isUmamiAvailable(123)).toBe(false);
		expect(isUmamiAvailable(true)).toBe(false);
	});

	it('should return false for object without track property', () => {
		expect(isUmamiAvailable({})).toBe(false);
		expect(isUmamiAvailable({ other: 'prop' })).toBe(false);
	});

	it('should return false for object with non-function track', () => {
		expect(isUmamiAvailable({ track: 'not a function' })).toBe(false);
		expect(isUmamiAvailable({ track: 123 })).toBe(false);
		expect(isUmamiAvailable({ track: null })).toBe(false);
	});
});

describe('respectsDoNotTrack', () => {
	const originalNavigator = global.navigator;
	const originalWindow = global.window;

	afterEach(() => {
		// Restore original values
		Object.defineProperty(global, 'navigator', {
			value: originalNavigator,
			writable: true,
			configurable: true,
		});
		Object.defineProperty(global, 'window', {
			value: originalWindow,
			writable: true,
			configurable: true,
		});
	});

	it('should return true when navigator.doNotTrack is "1"', () => {
		Object.defineProperty(global, 'navigator', {
			value: { doNotTrack: '1' },
			writable: true,
			configurable: true,
		});
		expect(respectsDoNotTrack()).toBe(true);
	});

	it('should return false when navigator.doNotTrack is "0"', () => {
		Object.defineProperty(global, 'navigator', {
			value: { doNotTrack: '0' },
			writable: true,
			configurable: true,
		});
		expect(respectsDoNotTrack()).toBe(false);
	});

	it('should return false when navigator.doNotTrack is null', () => {
		Object.defineProperty(global, 'navigator', {
			value: { doNotTrack: null },
			writable: true,
			configurable: true,
		});
		expect(respectsDoNotTrack()).toBe(false);
	});

	it('should return true when window.doNotTrack is "1" (legacy)', () => {
		Object.defineProperty(global, 'navigator', {
			value: { doNotTrack: null },
			writable: true,
			configurable: true,
		});
		Object.defineProperty(global, 'window', {
			value: { ...originalWindow, doNotTrack: '1' },
			writable: true,
			configurable: true,
		});
		expect(respectsDoNotTrack()).toBe(true);
	});
});

describe('safeTrack', () => {
	const originalWindow = global.window;

	beforeEach(() => {
		// Reset window.umami before each test
		if (typeof window !== 'undefined') {
			(window as Window & { umami?: UmamiTracker }).umami = undefined;
		}
	});

	afterEach(() => {
		Object.defineProperty(global, 'window', {
			value: originalWindow,
			writable: true,
			configurable: true,
		});
	});

	it('should not throw when Umami is unavailable', () => {
		expect(() => safeTrack('test_event')).not.toThrow();
	});

	it('should not throw when Umami is null', () => {
		(window as Window & { umami?: UmamiTracker | null }).umami = null;
		expect(() => safeTrack('test_event')).not.toThrow();
	});

	it('should call umami.track when available', () => {
		const mockTrack = vi.fn();
		(window as Window & { umami?: UmamiTracker }).umami = { track: mockTrack };

		safeTrack('test_event');

		expect(mockTrack).toHaveBeenCalledWith('test_event');
	});

	it('should pass event data to umami.track', () => {
		const mockTrack = vi.fn();
		(window as Window & { umami?: UmamiTracker }).umami = { track: mockTrack };

		safeTrack('test_event', { key: 'value' });

		expect(mockTrack).toHaveBeenCalledWith('test_event', { key: 'value' });
	});

	it('should silently catch errors from umami.track', () => {
		const mockTrack = vi.fn(() => {
			throw new Error('Umami error');
		});
		(window as Window & { umami?: UmamiTracker }).umami = { track: mockTrack };

		expect(() => safeTrack('test_event')).not.toThrow();
	});

	it('should not track when Do Not Track is enabled', () => {
		const mockTrack = vi.fn();
		(window as Window & { umami?: UmamiTracker }).umami = { track: mockTrack };

		Object.defineProperty(global, 'navigator', {
			value: { doNotTrack: '1' },
			writable: true,
			configurable: true,
		});

		safeTrack('test_event');

		expect(mockTrack).not.toHaveBeenCalled();
	});
});

describe('isAnalyticsEnabled', () => {
	const originalNavigator = global.navigator;
	const originalWindow = global.window;

	afterEach(() => {
		Object.defineProperty(global, 'navigator', {
			value: originalNavigator,
			writable: true,
			configurable: true,
		});
		Object.defineProperty(global, 'window', {
			value: originalWindow,
			writable: true,
			configurable: true,
		});
	});

	it('should return false when Umami is unavailable', () => {
		(window as Window & { umami?: UmamiTracker }).umami = undefined;
		Object.defineProperty(global, 'navigator', {
			value: { doNotTrack: null },
			writable: true,
			configurable: true,
		});
		expect(isAnalyticsEnabled()).toBe(false);
	});

	it('should return false when Do Not Track is enabled', () => {
		const mockTrack = vi.fn();
		(window as Window & { umami?: UmamiTracker }).umami = { track: mockTrack };
		Object.defineProperty(global, 'navigator', {
			value: { doNotTrack: '1' },
			writable: true,
			configurable: true,
		});
		expect(isAnalyticsEnabled()).toBe(false);
	});

	it('should return true when Umami is available and DNT is off', () => {
		const mockTrack = vi.fn();
		(window as Window & { umami?: UmamiTracker }).umami = { track: mockTrack };
		Object.defineProperty(global, 'navigator', {
			value: { doNotTrack: null },
			writable: true,
			configurable: true,
		});
		expect(isAnalyticsEnabled()).toBe(true);
	});
});

describe('debounce', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should delay function execution', () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 100);

		debounced();
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('should only call function once for rapid calls', () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 100);

		debounced();
		debounced();
		debounced();

		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('should reset timer on subsequent calls', () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 100);

		debounced();
		vi.advanceTimersByTime(50);
		debounced();
		vi.advanceTimersByTime(50);
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(50);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('should have cancel method that prevents execution', () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 100);

		debounced();
		debounced.cancel();

		vi.advanceTimersByTime(100);
		expect(fn).not.toHaveBeenCalled();
	});

	it('should use correct debounce delay for area explored', () => {
		expect(AREA_EXPLORED_DEBOUNCE_MS).toBe(2000);
	});
});
