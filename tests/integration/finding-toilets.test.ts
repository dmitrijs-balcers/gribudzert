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
});
