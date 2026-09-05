/**
 * Usage analytics: recorded when the site's tracker is present, never when the visitor
 * asked not to be tracked.
 */

import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../harness';

type TrackerWindow = Window & { umami?: { track: (...args: unknown[]) => void } };

describe('Analytics', () => {
	it('records that the map loaded', async () => {
		const track = vi.fn();
		(window as TrackerWindow).umami = { track };

		await renderApp();

		expect(track).toHaveBeenCalledWith('map_loaded', { location_type: 'user' });
	});

	it('records nothing when the visitor has Do Not Track enabled', async () => {
		const track = vi.fn();
		(window as TrackerWindow).umami = { track };
		Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });

		await renderApp();

		expect(track).not.toHaveBeenCalled();
	});
});
