/**
 * A visitor switches the "Public Toilets" layer on and off in the layer control.
 */

import { waitFor, within } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import {
	ACCESSIBLE_TOILET,
	isToiletQuery,
	TOILET_ELEMENTS,
	WATER_ELEMENTS,
	WATER_MARKER_COUNT,
} from '../fixtures';
import { renderApp } from '../harness';

describe('Finding public toilets', () => {
	it('starts with only the water layer enabled', async () => {
		const app = await renderApp();

		expect(app.layerCheckbox('Drinking Points').checked).toBe(true);
		expect(app.layerCheckbox('Public Toilets').checked).toBe(false);
		expect(app.overpass.requests.map((request) => isToiletQuery(request.query))).toEqual([false]);
		// One request, carrying only the water layer's selectors.
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

		const toilet = app.markers().length - 1 - 1; // circle markers precede icon markers
		app.openPopupOf(toilet);
		await waitFor(() => expect(app.popupText()).toContain('Public Toilet'));
		expect(app.popupText()).toContain('Wheelchair Accessible');
		expect(
			within(app.popup() as HTMLElement).getByRole('link', { name: 'Open on OpenStreetMap' })
		).toHaveProperty('href', expect.stringContaining(`/way/${ACCESSIBLE_TOILET.id}`));

		app.toggleLayer('Public Toilets');

		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		expect(app.overpass.requests).toHaveLength(2);
	});

	it('serves every active layer from a single combined request when the viewport changes', async () => {
		const app = await renderApp({
			overpass: (request) =>
				isToiletQuery(request.query) ? [...WATER_ELEMENTS, ...TOILET_ELEMENTS] : WATER_ELEMENTS,
		});
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		// Enabling toilets only refreshes the newly enabled layer (unchanged behaviour), so
		// this request carries just the toilet selectors.
		app.toggleLayer('Public Toilets');
		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + 1));

		// With both layers now active, a pan that crosses the padded area's edge must make
		// exactly ONE new request carrying both layers' selectors - never one per layer, since
		// the public Overpass API only grants 2 concurrent slots per IP. Two pans are needed to
		// cross the edge (see tests/integration/moving-around.test.ts); Leaflet ignores a
		// keyboard pan while the previous one is still animating, so they are spaced out.
		app.pan('right');
		await new Promise((resolve) => setTimeout(resolve, 500));
		app.pan('right');
		await waitFor(() => expect(app.overpass.requests).toHaveLength(3));

		const combined = app.overpass.lastRequest().query;
		expect(combined).toContain('amenity"="drinking_water');
		expect(combined).toContain('amenity"="toilets');

		// Both kinds of markers were rendered from that single combined response.
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + 1));
	});
});
