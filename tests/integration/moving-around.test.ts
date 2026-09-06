import { waitFor } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { WATER_MARKER_COUNT, waterNodesAt } from '../fixtures';
import type { AppHandle, OverpassReply } from '../harness';
import { bboxCenter, deferred, renderApp } from '../harness';

const NO_WATER_NOTICE =
	'No water points found in this area. Try zooming out or panning to a different location.';

const SINGLE_PAN_SETTLE_MS = 400;
const PAN_ANIMATION_SETTLE_MS = 500;

const pushViewportPastPaddedEdge = async (app: AppHandle): Promise<void> => {
	app.pan('right');
	await new Promise((resolve) => setTimeout(resolve, PAN_ANIMATION_SETTLE_MS));
	app.pan('right');
};

const pushViewportPastPaddedEdgeWithFakeTimers = async (app: AppHandle): Promise<void> => {
	app.pan('right');
	await vi.advanceTimersByTimeAsync(PAN_ANIMATION_SETTLE_MS);
	app.pan('right');
};

const zoomOutIntoANewEmptyArea = (app: AppHandle): void => {
	app.zoomOut();
};

describe('Moving around the map', () => {
	it('loads the new area only after crossing the padded edge, not after a single pan still inside it', async () => {
		const app = await renderApp();
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		app.overpass.respondWith((request) => waterNodesAt(bboxCenter(request.bbox), [301, 302]));

		app.pan('right');
		await new Promise((resolve) => setTimeout(resolve, SINGLE_PAN_SETTLE_MS));
		expect(app.overpass.requests).toHaveLength(1);

		app.pan('right');

		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		expect(app.overpass.requestAt(1).bbox.west).toBeGreaterThan(
			app.overpass.requestAt(0).bbox.west
		);
		const originalAndNewlyLoadedPointsBothStay = WATER_MARKER_COUNT + 2;
		await waitFor(() => expect(app.markers()).toHaveLength(originalAndNewlyLoadedPointsBothStay));
	});

	it('cancels the previous request when panning again and shows only the latest area', async () => {
		const stale = deferred<OverpassReply>();
		const latest = deferred<OverpassReply>();
		const app = await renderApp();
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		app.overpass.respondWith(() =>
			app.overpass.requests.length === 2 ? stale.promise : latest.promise
		);

		await pushViewportPastPaddedEdge(app);
		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		await pushViewportPastPaddedEdge(app);
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

		zoomOutIntoANewEmptyArea(app);
		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		await vi.advanceTimersByTimeAsync(1_000);
		expect(app.toastHistory().filter((toast) => toast === NO_WATER_NOTICE)).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(31_000);
		await pushViewportPastPaddedEdgeWithFakeTimers(app);
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
