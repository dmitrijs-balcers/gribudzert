import { waitFor } from '@testing-library/dom';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { FACILITY_CACHE_TTL_MS } from '../../src/core/config';
import { boundsOfTiles, tilesCovering } from '../../src/domain';
import { NEAREST_TAP_TO_USER, NON_DRINKABLE, WATER_MARKER_COUNT, waterNodesAt } from '../fixtures';
import type { AppHandle, Bbox, OverpassReply } from '../harness';
import {
	bboxCenter,
	deferred,
	GEO_PERMISSION_DENIED,
	makeIndexedDbOpenSlow,
	renderApp,
	seedSnapshot,
} from '../harness';

const OFFLINE_SHOWING_SAVED = "Couldn't refresh map data. Showing saved points.";
const NETWORK_ERROR =
	'Failed to load water points. Please check your internet connection and try again.';

const FLOATING_POINT_TOLERANCE_DIGITS = 6;

const expectBboxIsExactTileAlignedHullOfItsOwnTiles = (bbox: Bbox): void => {
	const hull = boundsOfTiles(tilesCovering(bbox));
	if (hull === null) {
		throw new Error('tilesCovering(bbox) returned no tiles');
	}
	expect(bbox.west).toBeCloseTo(hull.west, FLOATING_POINT_TOLERANCE_DIGITS);
	expect(bbox.east).toBeCloseTo(hull.east, FLOATING_POINT_TOLERANCE_DIGITS);
	expect(bbox.north).toBeCloseTo(hull.north, FLOATING_POINT_TOLERANCE_DIGITS);
	expect(bbox.south).toBeCloseTo(hull.south, FLOATING_POINT_TOLERANCE_DIGITS);
};

const CACHE_REVALIDATION_MARGIN_MS = 60_000;

const advanceSystemClockPastCacheTtl = (): void => {
	vi.setSystemTime(new Date(Date.now() + FACILITY_CACHE_TTL_MS + CACHE_REVALIDATION_MARGIN_MS));
};

const PAN_ANIMATION_SETTLE_MS = 500;

const pushViewportPastPaddedEdge = async (app: AppHandle): Promise<void> => {
	await app.pan('right');
	await new Promise((resolve) => setTimeout(resolve, PAN_ANIMATION_SETTLE_MS));
	await app.pan('right');
};

describe('Coming back later', () => {
	it('shows saved points right after a reload even if the Overpass reply never arrives', async () => {
		const first = await renderApp();
		await waitFor(() => expect(first.markers()).toHaveLength(WATER_MARKER_COUNT));

		const overpassReplyThatNeverArrives = deferred<OverpassReply>();
		const app = await renderApp({
			reload: true,
			overpass: () => overpassReplyThatNeverArrives.promise,
		});

		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
	});

	it('does not ask Overpass again for an area saved recently', async () => {
		const first = await renderApp({ geolocation: { error: GEO_PERMISSION_DENIED } });
		await waitFor(() => expect(first.markers()).toHaveLength(WATER_MARKER_COUNT));

		const app = await renderApp({ reload: true, geolocation: { error: GEO_PERMISSION_DENIED } });
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

			advanceSystemClockPastCacheTtl();
			const survivingElements = [NEAREST_TAP_TO_USER, NON_DRINKABLE];
			const app = await renderApp({
				reload: true,
				settle: false,
				overpass: () => survivingElements,
			});

			await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
			await app.settled();
			await waitFor(() => expect(app.markers()).toHaveLength(survivingElements.length));

			expectBboxIsExactTileAlignedHullOfItsOwnTiles(app.overpass.lastRequest().bbox);
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

			advanceSystemClockPastCacheTtl();
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

		await pushViewportPastPaddedEdge(app);

		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		const secondRequestAsksOnlyForTheUnsavedStrip =
			app.overpass.requestAt(1).bbox.west > app.overpass.requestAt(0).bbox.west;
		expect(secondRequestAsksOnlyForTheUnsavedStrip).toBe(true);
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + 2));
	});

	const CACHE_PERSIST_SETTLE_MS = 200;
	const SLOW_INDEXED_DB_OPEN_DELAY_MS = 3_000;
	const SLOW_CACHE_MARKERS_TIMEOUT_MS = 6_000;

	it('shows saved points once a slow cache finally loads, even while Overpass is still busy', async () => {
		const first = await renderApp({ geolocation: { error: GEO_PERMISSION_DENIED } });
		await waitFor(() => expect(first.markers()).toHaveLength(WATER_MARKER_COUNT));
		await new Promise((resolve) => setTimeout(resolve, CACHE_PERSIST_SETTLE_MS));

		const restoreIndexedDbOpen = makeIndexedDbOpenSlow(SLOW_INDEXED_DB_OPEN_DELAY_MS);
		try {
			const overpassReplyThatNeverArrives = deferred<OverpassReply>();
			const app = await renderApp({
				reload: true,
				settle: false,
				geolocation: { error: GEO_PERMISSION_DENIED },
				overpass: () => overpassReplyThatNeverArrives.promise,
			});

			await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT), {
				timeout: SLOW_CACHE_MARKERS_TIMEOUT_MS,
			});
		} finally {
			restoreIndexedDbOpen();
		}
	}, 20_000);
});
