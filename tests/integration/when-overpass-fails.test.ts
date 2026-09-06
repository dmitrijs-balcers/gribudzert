/**
 * The Overpass API is down or slow: the visitor sees an error and the loading overlay
 * never gets stuck on screen.
 */

import { waitFor } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { WATER_ELEMENTS, WATER_MARKER_COUNT } from '../fixtures';
import type { OverpassReply } from '../harness';
import { renderApp } from '../harness';

const NETWORK_ERROR =
	'Failed to load water points. Please check your internet connection and try again.';
const TIMEOUT_ERROR = 'Request timed out while loading water points. Please try again.';
const BUSY_ERROR = 'The map data service is busy right now. Please wait a moment and try again.';
const OFFLINE_SHOWING_SAVED = "Couldn't refresh map data. Showing saved points.";

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

	it('retries a busy response once and shows markers without any error toast', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		let attempts = 0;
		const app = await renderApp({
			overpass: () => {
				attempts += 1;
				return attempts === 1 ? { status: 429, retryAfter: 2 } : WATER_ELEMENTS;
			},
			settle: false,
		});

		await vi.advanceTimersByTimeAsync(2_000);
		await app.settled();

		expect(app.overpass.requests).toHaveLength(2);
		expect(app.toasts()).toHaveLength(0);
		expect(app.markers().length).toBeGreaterThan(0);
	});

	it('reports the busy message, not an internet-connection message, when the retry is also busy', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const app = await renderApp({
			overpass: () => ({ status: 429, retryAfter: 1 }),
			settle: false,
		});

		await vi.advanceTimersByTimeAsync(1_000);

		await waitFor(() => expect(app.toasts()).toContain(BUSY_ERROR));
		expect(app.toasts().some((message) => message.includes('internet connection'))).toBe(false);
		await waitFor(() => expect(app.loadingVisible()).toBe(false));
		expect(app.markers()).toHaveLength(0);
	});

	it('still blames the connection for a plain server error', async () => {
		const app = await renderApp({ overpass: () => ({ status: 500 }), settle: false });

		await waitFor(() => expect(app.toasts()).toContain(NETWORK_ERROR));
		await waitFor(() => expect(app.loadingVisible()).toBe(false));
	});

	it('announces a failed request once even when it served both layers', async () => {
		const app = await renderApp();
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		app.toggleLayer('Public Toilets');
		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		await app.settled();
		app.overpass.respondWith(() => ({ status: 500 }));

		// Two pans push the viewport past the padded area and trigger one shared request.
		app.pan('right');
		await new Promise((resolve) => setTimeout(resolve, 400));
		app.pan('right');

		await waitFor(() => expect(app.overpass.requests).toHaveLength(3));
		expect(app.overpass.lastRequest().query).toContain('amenity"="toilets');
		// The panned-to area is partly covered by the offline cache (from the very first
		// load), so the viewer is already looking at saved points when this request fails -
		// the "showing saved points" message replaces the usual per-layer error, and only
		// once, even though the shared request served both layers.
		await waitFor(() => expect(app.toasts()).toContain(OFFLINE_SHOWING_SAVED));
		await waitFor(() => expect(app.loadingVisible()).toBe(false));
		expect(app.toasts().filter((toast) => toast === OFFLINE_SHOWING_SAVED)).toHaveLength(1);
		expect(app.toasts()).not.toContain(NETWORK_ERROR);
	});
});
