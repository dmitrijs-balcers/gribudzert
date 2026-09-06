/**
 * A visitor zooms out too far for a useful query: the map empties, they are told once to
 * zoom in, and zooming back in loads the area again.
 */

import { waitFor } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { WATER_MARKER_COUNT } from '../fixtures';
import { renderApp } from '../harness';

const ZOOM_IN_NOTICE = 'Zoom in to see water points and toilets';

/**
 * Long enough for the map to settle and decide whether to load the new view
 */
const settleView = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 500));

describe('Zooming out', () => {
	it('stops loading, clears the map and asks once to zoom in; zooming back in reloads', async () => {
		const app = await renderApp();
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		app.zoomOut(); // still close enough to query
		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		app.zoomOut(); // too far out
		await waitFor(() => expect(app.toasts()).toContain(ZOOM_IN_NOTICE));
		expect(app.markers()).toHaveLength(0);
		expect(app.overpass.requests).toHaveLength(2);

		app.zoomOut(); // even further out
		await settleView();
		expect(app.overpass.requests).toHaveLength(2);
		expect(app.toastHistory().filter((toast) => toast === ZOOM_IN_NOTICE)).toHaveLength(1);

		app.zoomIn(); // still too far out
		await settleView();
		expect(app.overpass.requests).toHaveLength(2);
		expect(app.markers()).toHaveLength(0);

		app.zoomIn(); // close enough again, same area as after the first zoom-out
		// The offline cache still has that area fresh from the earlier request, so the
		// points reappear straight from the cache without a third network round trip.
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		expect(app.overpass.requests).toHaveLength(2);
		expect(app.toastHistory().filter((toast) => toast === ZOOM_IN_NOTICE)).toHaveLength(1);
	});
});
