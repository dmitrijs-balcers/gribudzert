import { waitFor, within } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import type { OverpassElement } from '../fixtures';
import {
	ACCESSIBLE_TOILET,
	isToiletQuery,
	TOILET_ELEMENTS,
	WATER_ELEMENTS,
	WATER_MARKER_COUNT,
	waterNodesAt,
} from '../fixtures';
import type { AppHandle } from '../harness';
import { bboxCenter, renderApp } from '../harness';

const toiletAt = (
	center: { readonly lat: number; readonly lon: number },
	id: number
): OverpassElement => ({
	type: 'way',
	id,
	center,
	tags: { amenity: 'toilets' },
});

const PAN_ANIMATION_SETTLE_MS = 500;

const pushViewportPastPaddedEdge = async (app: AppHandle): Promise<void> => {
	app.pan('right');
	await new Promise((resolve) => setTimeout(resolve, PAN_ANIMATION_SETTLE_MS));
	app.pan('right');
};

describe('Finding public toilets', () => {
	it('starts with only the water layer enabled', async () => {
		const app = await renderApp();

		expect(app.layerCheckbox('Drinking Points').checked).toBe(true);
		expect(app.layerCheckbox('Public Toilets').checked).toBe(false);
		expect(app.overpass.requests.map((request) => isToiletQuery(request.query))).toEqual([false]);
		expect(app.overpass.lastRequest().query).toContain('amenity"="drinking_water');
	});

	it('loads toilets when the layer is ticked and drops them when it is unticked', async () => {
		const app = await renderApp({
			overpass: (request) => (isToiletQuery(request.query) ? TOILET_ELEMENTS : WATER_ELEMENTS),
		});
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		app.toggleLayer('Public Toilets');

		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		expect(app.overpass.lastRequest().query).toContain('amenity"="toilets');
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + 1));

		const newestMarkerIndex = app.markers().length - 1;
		const toiletMarker = app.markers()[newestMarkerIndex] as HTMLElement;
		expect(toiletMarker.textContent).toContain('🚻');
		expect(toiletMarker.getAttribute('data-facility-kind')).toBe('toilet');
		expect(toiletMarker.getAttribute('title')).toContain('Public Toilet');

		app.openPopupOf(newestMarkerIndex);
		await waitFor(() => expect(app.popupText()).toContain('Public Toilet'));
		expect(app.popupText()).toContain('Wheelchair Accessible');
		expect(
			within(app.popup() as HTMLElement).getByRole('link', { name: 'Open on OpenStreetMap' })
		).toHaveProperty('href', expect.stringContaining(`/way/${ACCESSIBLE_TOILET.id}`));

		app.toggleLayer('Public Toilets');

		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		expect(app.overpass.requests).toHaveLength(2);
	});

	it('serves every active layer from one combined request per viewport change, never one request per layer', async () => {
		const app = await renderApp({
			overpass: (request) =>
				isToiletQuery(request.query) ? [...WATER_ELEMENTS, ...TOILET_ELEMENTS] : WATER_ELEMENTS,
		});
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		app.toggleLayer('Public Toilets');
		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + 1));

		await pushViewportPastPaddedEdge(app);
		await waitFor(() => expect(app.overpass.requests).toHaveLength(3));

		const combined = app.overpass.lastRequest().query;
		expect(combined).toContain('amenity"="drinking_water');
		expect(combined).toContain('amenity"="toilets');

		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + 1));
	});

	it('shows saved toilets right after a reload without asking Overpass', async () => {
		const first = await renderApp({
			overpass: (request) => (isToiletQuery(request.query) ? TOILET_ELEMENTS : WATER_ELEMENTS),
		});
		await waitFor(() => expect(first.markers()).toHaveLength(WATER_MARKER_COUNT));

		first.toggleLayer('Public Toilets');
		await waitFor(() => expect(first.markers()).toHaveLength(WATER_MARKER_COUNT + 1));

		const app = await renderApp({ reload: true });
		await waitFor(() => app.layerCheckbox('Public Toilets'));
		app.toggleLayer('Public Toilets');
		await new Promise((resolve) => setTimeout(resolve, 600));

		expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + 1);
		expect(app.overpass.requests.some((request) => isToiletQuery(request.query))).toBe(false);
	});

	it('keeps toilets on the map after panning into a new area, merging the fresh strip with the cache', async () => {
		const app = await renderApp({
			overpass: (request) => (isToiletQuery(request.query) ? TOILET_ELEMENTS : WATER_ELEMENTS),
		});
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		app.toggleLayer('Public Toilets');
		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + 1));

		app.overpass.respondWith((request) => [
			...waterNodesAt(bboxCenter(request.bbox), [601]),
			toiletAt(bboxCenter(request.bbox), 602),
		]);

		await pushViewportPastPaddedEdge(app);

		await waitFor(() => expect(app.overpass.requests).toHaveLength(3));
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + 1 + 2));
	});
});
