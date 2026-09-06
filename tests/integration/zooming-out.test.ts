import { waitFor } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { WATER_MARKER_COUNT } from '../fixtures';
import type { AppHandle } from '../harness';
import { renderApp } from '../harness';

const ZOOM_IN_NOTICE = 'Zoom in to see water points and toilets';

const VIEW_SETTLE_MS = 500;
const settleView = (): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, VIEW_SETTLE_MS));

const zoomOutStillCloseEnoughToQuery = (app: AppHandle): void => app.zoomOut();
const zoomOutTooFarToQuery = (app: AppHandle): void => app.zoomOut();
const zoomOutEvenFurther = (app: AppHandle): void => app.zoomOut();
const zoomInStillTooFarToQuery = (app: AppHandle): void => app.zoomIn();
const zoomInBackToTheFirstQueryableArea = (app: AppHandle): void => app.zoomIn();

describe('Zooming out', () => {
	it('stops loading, clears the map and asks once to zoom in; zooming back in reloads from the cache without a third request', async () => {
		const app = await renderApp();
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		zoomOutStillCloseEnoughToQuery(app);
		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		zoomOutTooFarToQuery(app);
		await waitFor(() => expect(app.toasts()).toContain(ZOOM_IN_NOTICE));
		expect(app.markers()).toHaveLength(0);
		expect(app.overpass.requests).toHaveLength(2);

		zoomOutEvenFurther(app);
		await settleView();
		expect(app.overpass.requests).toHaveLength(2);
		expect(app.toastHistory().filter((toast) => toast === ZOOM_IN_NOTICE)).toHaveLength(1);

		zoomInStillTooFarToQuery(app);
		await settleView();
		expect(app.overpass.requests).toHaveLength(2);
		expect(app.markers()).toHaveLength(0);

		zoomInBackToTheFirstQueryableArea(app);
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		expect(app.overpass.requests).toHaveLength(2);
		expect(app.toastHistory().filter((toast) => toast === ZOOM_IN_NOTICE)).toHaveLength(1);
	});
});
