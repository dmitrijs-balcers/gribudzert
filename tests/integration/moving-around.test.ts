/**
 * A visitor pans the map: new areas load, stale requests are cancelled, and an empty area
 * is announced without nagging.
 */

import { waitFor } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { WATER_MARKER_COUNT, waterNodesAt } from '../fixtures';
import type { OverpassReply } from '../harness';
import { bboxCenter, deferred, renderApp } from '../harness';

const NO_WATER_NOTICE =
	'No water points found in this area. Try zooming out or panning to a different location.';

describe('Moving around the map', () => {
	it('loads the new area after panning far enough', async () => {
		const app = await renderApp();
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		app.overpass.respondWith((request) => waterNodesAt(bboxCenter(request.bbox), [301, 302]));

		app.pan('right');

		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		expect(app.overpass.requestAt(1).bbox.west).toBeGreaterThan(
			app.overpass.requestAt(0).bbox.west
		);
		await waitFor(() => expect(app.markers()).toHaveLength(2));
	});

	it('cancels the previous request when panning again and shows only the latest area', async () => {
		const stale = deferred<OverpassReply>();
		const latest = deferred<OverpassReply>();
		const app = await renderApp();
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		app.overpass.respondWith(() =>
			app.overpass.requests.length === 2 ? stale.promise : latest.promise
		);

		app.pan('right');
		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		app.pan('right');
		await waitFor(() => expect(app.overpass.requests).toHaveLength(3));

		const first = app.overpass.requestAt(1);
		const second = app.overpass.requestAt(2);
		expect(first.aborted).toBe(true);
		expect(second.aborted).toBe(false);

		stale.resolve(waterNodesAt(bboxCenter(first.bbox), [401]));
		latest.resolve(waterNodesAt(bboxCenter(second.bbox), [501, 502]));

		await waitFor(() => expect(app.markers()).toHaveLength(2));
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(app.markers()).toHaveLength(2);
	});

	it('announces an empty area once, then stays quiet until the cooldown has passed', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const app = await renderApp({ overpass: () => [] });

		await waitFor(() => expect(app.toasts()).toContain(NO_WATER_NOTICE));
		expect(app.markers()).toHaveLength(0);

		app.zoomOut(); // a new, still empty view shortly after
		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		await vi.advanceTimersByTimeAsync(1_000);
		expect(app.toastHistory().filter((toast) => toast === NO_WATER_NOTICE)).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(31_000);
		app.zoomIn(); // another empty view, after the cooldown
		await waitFor(() => expect(app.overpass.requests).toHaveLength(3));
		await waitFor(() =>
			expect(app.toastHistory().filter((toast) => toast === NO_WATER_NOTICE)).toHaveLength(2)
		);
	});

	it('keeps the markers when a pan is too small to change the area', async () => {
		const app = await renderApp();
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		app.pan('down', { far: false });
		await new Promise((resolve) => setTimeout(resolve, 600));

		expect(app.overpass.requests).toHaveLength(1);
		expect(app.markers()).toHaveLength(WATER_MARKER_COUNT);
	});
});
