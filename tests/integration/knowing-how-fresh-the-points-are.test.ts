import { waitFor } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { FACILITY_CACHE_TTL_MS } from '../../src/core/config';
import { WATER_ELEMENTS, WATER_MARKER_COUNT } from '../fixtures';
import type { OverpassReply } from '../harness';
import { deferred, GEO_PERMISSION_DENIED, renderApp } from '../harness';

const OFFLINE_SHOWING_SAVED = "Couldn't refresh map data. Showing saved points.";
const ZOOM_IN_NOTICE = 'Zoom in to see water points and toilets';

const CACHE_REVALIDATION_MARGIN_MS = 60_000;

const advanceSystemClockPastCacheTtl = (): void => {
	vi.setSystemTime(new Date(Date.now() + FACILITY_CACHE_TTL_MS + CACHE_REVALIDATION_MARGIN_MS));
};

describe('Knowing how fresh the points are', () => {
	it('shows "updating" while the Overpass reply is still on its way, then "live" once it answers', async () => {
		const reply = deferred<OverpassReply>();
		const app = await renderApp({ overpass: () => reply.promise, settle: false });

		await waitFor(() => expect(app.provenance()).toBe('updating'));

		reply.resolve(WATER_ELEMENTS);

		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		await waitFor(() => expect(app.provenance()).toBe('live'));
	});

	it('shows "saved" after a reload when the area was saved recently and Overpass is not asked again', async () => {
		const first = await renderApp({ geolocation: { error: GEO_PERMISSION_DENIED } });
		await waitFor(() => expect(first.markers()).toHaveLength(WATER_MARKER_COUNT));

		const app = await renderApp({ reload: true, geolocation: { error: GEO_PERMISSION_DENIED } });
		await new Promise((resolve) => setTimeout(resolve, 600));

		expect(app.overpass.requests).toHaveLength(0);
		expect(app.provenance()).toBe('saved');
	});

	it('shows "failed" when Overpass fails on a fresh area', async () => {
		const app = await renderApp({
			overpass: () => new Error('connection reset'),
			settle: false,
		});

		await waitFor(() => expect(app.provenance()).toBe('failed'));
		expect(app.markers()).toHaveLength(0);
	});

	it('shows "failed" while keeping the saved points when a long-saved area cannot be refreshed', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		try {
			vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
			const first = await renderApp();
			await waitFor(() => expect(first.markers()).toHaveLength(WATER_MARKER_COUNT));

			advanceSystemClockPastCacheTtl();
			const app = await renderApp({
				reload: true,
				overpass: () => new Error('connection reset'),
			});

			await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
			await waitFor(() => expect(app.toasts()).toContain(OFFLINE_SHOWING_SAVED));
			expect(app.markers()).toHaveLength(WATER_MARKER_COUNT);
			await waitFor(() => expect(app.provenance()).toBe('failed'));
		} finally {
			vi.useRealTimers();
		}
	});

	it('hides the indicator when zoomed out too far and shows it again after zooming back in', async () => {
		const app = await renderApp({ geolocation: { error: GEO_PERMISSION_DENIED } });
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		expect(app.provenance()).not.toBeNull();

		app.zoomOut();
		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		app.zoomOut();
		await waitFor(() => expect(app.toasts()).toContain(ZOOM_IN_NOTICE));
		expect(app.provenance()).toBeNull();

		app.zoomIn();
		app.zoomIn();
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		expect(app.provenance()).not.toBeNull();
	});
});
