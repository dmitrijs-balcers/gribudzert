/**
 * A visitor comes back to the map later (a reload, or the next day): what was already
 * fetched shows immediately from the offline cache, only what is stale or was never seen
 * goes back to Overpass, and the viewer keeps seeing saved points when the network can't be
 * reached or the saved data can't be trusted.
 */

import { waitFor } from '@testing-library/dom';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { FACILITY_CACHE_TTL_MS } from '../../src/core/config';
import { boundsOfTiles, tilesCovering } from '../../src/domain';
import { NEAREST_TO_USER, NON_DRINKABLE, WATER_MARKER_COUNT, waterNodesAt } from '../fixtures';
import type { Bbox, OverpassReply } from '../harness';
import { bboxCenter, deferred, renderApp, seedSnapshot } from '../harness';

const OFFLINE_SHOWING_SAVED = "Couldn't refresh map data. Showing saved points.";
const NETWORK_ERROR =
	'Failed to load water points. Please check your internet connection and try again.';

/**
 * Whether `bbox` is exactly the tile-aligned hull of the tiles it covers: re-deriving tiles
 * from it and re-deriving bounds from those tiles must be a no-op, up to floating-point noise
 * from the Leaflet bounds round trip.
 */
const isTileAligned = (bbox: Bbox): void => {
	const hull = boundsOfTiles(tilesCovering(bbox));
	if (hull === null) {
		throw new Error('tilesCovering(bbox) returned no tiles');
	}
	expect(bbox.west).toBeCloseTo(hull.west, 6);
	expect(bbox.east).toBeCloseTo(hull.east, 6);
	expect(bbox.north).toBeCloseTo(hull.north, 6);
	expect(bbox.south).toBeCloseTo(hull.south, 6);
};

/**
 * Move the fake system clock forward past the cache TTL, so everything fetched under the
 * previous time is now stale
 */
const advancePastTtl = (): void => {
	vi.setSystemTime(new Date(Date.now() + FACILITY_CACHE_TTL_MS + 60_000));
};

describe('Coming back later', () => {
	it('shows saved points right after a reload, before Overpass answers', async () => {
		const first = await renderApp();
		await waitFor(() => expect(first.markers()).toHaveLength(WATER_MARKER_COUNT));

		// The area is still fresh, so nothing needs Overpass - but even if it did, a reply
		// that never arrives must never keep the saved points off the map.
		const pending = deferred<OverpassReply>();
		const app = await renderApp({ reload: true, overpass: () => pending.promise });

		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		expect(app.loadingVisible()).toBe(false);
	});

	it('does not ask Overpass again for an area saved recently', async () => {
		const first = await renderApp();
		await waitFor(() => expect(first.markers()).toHaveLength(WATER_MARKER_COUNT));

		const app = await renderApp({ reload: true });
		await new Promise((resolve) => setTimeout(resolve, 600));

		expect(app.overpass.requests).toHaveLength(0);
		expect(app.markers()).toHaveLength(WATER_MARKER_COUNT);
	});

	it('revalidates an area saved long ago and drops points that are gone', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		try {
			vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
			const first = await renderApp();
			await waitFor(() => expect(first.markers()).toHaveLength(WATER_MARKER_COUNT));

			advancePastTtl();
			const app = await renderApp({
				reload: true,
				settle: false,
				// Only two of the original three elements survive the revalidation.
				overpass: () => [NEAREST_TO_USER, NON_DRINKABLE],
			});

			// The stale cache is shown immediately, before the revalidation settles...
			await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
			await app.settled();
			// ...then the point Overpass no longer reports is dropped.
			await waitFor(() => expect(app.markers()).toHaveLength(2));

			isTileAligned(app.overpass.lastRequest().bbox);
		} finally {
			vi.useRealTimers();
		}
	});

	it('keeps showing saved points when Overpass is unreachable', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		try {
			vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
			const first = await renderApp();
			await waitFor(() => expect(first.markers()).toHaveLength(WATER_MARKER_COUNT));

			advancePastTtl();
			const app = await renderApp({
				reload: true,
				overpass: () => new Error('connection reset'),
			});

			await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
			await waitFor(() => expect(app.toasts()).toContain(OFFLINE_SHOWING_SAVED));
			expect(app.markers()).toHaveLength(WATER_MARKER_COUNT);
			expect(app.toasts()).not.toContain(NETWORK_ERROR);
		} finally {
			vi.useRealTimers();
		}
	});

	it('ignores a saved snapshot it cannot trust', async () => {
		await seedSnapshot({ version: 999 });
		const wrongVersion = await renderApp();
		await waitFor(() => expect(wrongVersion.markers()).toHaveLength(WATER_MARKER_COUNT));

		globalThis.indexedDB = new IDBFactory();
		await seedSnapshot('not even an object');
		const garbage = await renderApp();
		await waitFor(() => expect(garbage.markers()).toHaveLength(WATER_MARKER_COUNT));
	});

	it('fetches only the strip that is not saved yet', async () => {
		const app = await renderApp();
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		app.overpass.respondWith((request) => waterNodesAt(bboxCenter(request.bbox), [601, 602]));

		// Two pans push the viewport past the padded area, as in moving-around.test.ts.
		app.pan('right');
		await new Promise((resolve) => setTimeout(resolve, 500));
		app.pan('right');

		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		// The second request only asks for the strip that was not saved yet, starting east
		// of the first request's western edge rather than repeating the whole padded area.
		expect(app.overpass.requestAt(1).bbox.west).toBeGreaterThan(
			app.overpass.requestAt(0).bbox.west
		);
		// Old and new points are both shown - the cache and the fresh strip are merged.
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + 2));
	});
});
