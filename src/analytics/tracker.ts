/**
 * Analytics Tracker Core
 *
 * Core tracking logic with Umami integration.
 * Follows fire-and-forget pattern - all functions are void and never throw.
 *
 * @module analytics/tracker
 */

import type { UmamiEventData, UmamiTracker } from './types';

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if Umami is available and properly loaded
 * @param umami - Value to check (typically window.umami)
 * @returns True if umami is a valid UmamiTracker with track function
 */
export const isUmamiAvailable = (umami: unknown): umami is UmamiTracker => {
	return (
		typeof umami === 'object' &&
		umami !== null &&
		'track' in umami &&
		typeof (umami as UmamiTracker).track === 'function'
	);
};

// =============================================================================
// Privacy Checks
// =============================================================================

/**
 * Check if user has Do Not Track enabled
 * Respects both navigator.doNotTrack and window.doNotTrack
 * @returns True if user has opted out of tracking
 */
export const respectsDoNotTrack = (): boolean => {
	// Check navigator.doNotTrack (standard)
	if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') {
		return true;
	}

	// Check window.doNotTrack (legacy IE)
	if (
		typeof window !== 'undefined' &&
		(window as Window & { doNotTrack?: string }).doNotTrack === '1'
	) {
		return true;
	}

	return false;
};

/**
 * Check if analytics is enabled and available
 * Returns false if:
 * - Umami script is not loaded
 * - User has Do Not Track enabled
 * - Script is blocked (ad blocker)
 * @returns True if analytics can track events
 */
export const isAnalyticsEnabled = (): boolean => {
	// Respect Do Not Track preference
	if (respectsDoNotTrack()) {
		return false;
	}

	// Check if Umami is available
	if (typeof window === 'undefined') {
		return false;
	}

	return isUmamiAvailable(window.umami);
};

// =============================================================================
// Core Tracking
// =============================================================================

/**
 * Safely track an event to Umami
 * Fire-and-forget pattern: never throws, returns void
 * @param eventName - Name of the event (snake_case)
 * @param data - Optional event data
 */
export const safeTrack = (eventName: string, data?: UmamiEventData): void => {
	try {
		// Check if analytics is enabled
		if (!isAnalyticsEnabled()) {
			return;
		}

		// TypeScript knows window.umami is UmamiTracker here due to isAnalyticsEnabled check
		// But we need to re-check for type narrowing
		if (isUmamiAvailable(window.umami)) {
			if (data !== undefined) {
				window.umami.track(eventName, data);
			} else {
				window.umami.track(eventName);
			}
		}
	} catch {
		// Silently ignore - analytics failures should never affect app
		// This catches any runtime errors from Umami
	}
};

// =============================================================================
// Debounce Utility
// =============================================================================

/**
 * Debounced function type with cancel capability
 */
export type DebouncedFn<T extends (...args: never[]) => void> = T & {
	readonly cancel: () => void;
};

/**
 * Create a trailing-edge debounced function
 * Delays invoking func until after ms milliseconds have elapsed
 * since the last time the debounced function was invoked.
 *
 * @param fn - Function to debounce
 * @param ms - Delay in milliseconds
 * @returns Debounced function with cancel method
 */
export const debounce = <T extends (...args: never[]) => void>(
	fn: T,
	ms: number
): DebouncedFn<T> => {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const cancel = (): void => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
	};

	const debounced = ((...args: Parameters<T>): void => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
		}
		timeoutId = setTimeout(() => {
			fn(...args);
			timeoutId = null;
		}, ms);
	}) as T & { cancel: () => void };

	debounced.cancel = cancel;

	return debounced as DebouncedFn<T>;
};

/**
 * Debounce delay for area exploration events (per FR-004)
 * Max 1 event per 2000ms to prevent flooding
 */
export const AREA_EXPLORED_DEBOUNCE_MS = 2000;
