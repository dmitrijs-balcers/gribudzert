/**
 * The Overpass API is down or slow: the visitor sees an error and the loading overlay
 * never gets stuck on screen.
 */

import { waitFor } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import type { OverpassReply } from '../harness';
import { renderApp } from '../harness';

const NETWORK_ERROR =
	'Failed to load water points. Please check your internet connection and try again.';
const TIMEOUT_ERROR = 'Request timed out while loading water points. Please try again.';

const failAfter = (ms: number): Promise<OverpassReply> =>
	new Promise((resolve) => setTimeout(() => resolve(new Error('connection reset')), ms));

describe('When Overpass fails', () => {
	it('shows the loading overlay while waiting, then an error, then hides the overlay', async () => {
		const app = await renderApp({ overpass: () => failAfter(400), settle: false });

		await waitFor(() => expect(app.loadingVisible()).toBe(true));
		await waitFor(() => expect(app.toasts()).toContain(NETWORK_ERROR));
		await waitFor(() => expect(app.loadingVisible()).toBe(false));
		expect(app.markers()).toHaveLength(0);
	});

	it('gives up on a request that never answers and tells the visitor it timed out', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const app = await renderApp({ overpass: () => 'timeout', settle: false });

		await vi.advanceTimersByTimeAsync(30_000);

		await waitFor(() => expect(app.toasts()).toContain(TIMEOUT_ERROR));
		expect(app.overpass.lastRequest().aborted).toBe(true);
		await waitFor(() => expect(app.loadingVisible()).toBe(false));
	});
});
