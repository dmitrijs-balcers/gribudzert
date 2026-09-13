import { waitFor } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import {
	BRANDED_FUEL_STATION,
	FUEL_ELEMENTS,
	isFuelQuery,
	WATER_ELEMENTS,
	WATER_MARKER_COUNT,
} from '../fixtures';
import { renderApp } from '../harness';

const fuelMarkersOf = (markers: readonly Element[]): readonly Element[] =>
	markers.filter((marker) => marker.getAttribute('data-facility-kind') === 'fuel');

describe('Finding gas stations', () => {
	it('starts with gas stations on, asking Overpass for them together with water', async () => {
		const app = await renderApp();

		expect(app.isLayerOn('Gas Stations')).toBe(true);
		expect(app.isLayerOn('Drinking Points')).toBe(true);
		await waitFor(() => expect(app.overpass.requests).toHaveLength(1));
		const query = app.overpass.lastRequest().query;
		expect(isFuelQuery(query)).toBe(true);
		expect(query).toContain('amenity"="drinking_water');
	});

	it('stays quiet when there are no gas stations around', async () => {
		const app = await renderApp();
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		expect(app.toastHistory().some((toast) => toast.includes('gas station'))).toBe(false);
	});

	it('shows each station with a pump icon and its brand name under the marker', async () => {
		const app = await renderApp({
			overpass: (request) =>
				isFuelQuery(request.query) ? [...WATER_ELEMENTS, ...FUEL_ELEMENTS] : WATER_ELEMENTS,
		});

		await waitFor(() =>
			expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + FUEL_ELEMENTS.length)
		);

		const fuelMarkers = fuelMarkersOf(app.markers());
		expect(fuelMarkers).toHaveLength(FUEL_ELEMENTS.length);
		for (const marker of fuelMarkers) {
			expect(marker.textContent).toContain('⛽');
			expect(marker.classList.contains('facility-marker--fuel')).toBe(true);
			expect(marker.getAttribute('title')).toContain('Gas Station');
		}

		const nameOf = (marker: Element): string | null =>
			marker.querySelector('.facility-marker-name')?.textContent ?? null;
		expect(fuelMarkers.map(nameOf).sort()).toEqual([null, 'Circle K'].sort());

		const branded = fuelMarkers.find((marker) => nameOf(marker) === 'Circle K');
		expect(branded?.getAttribute('title')).toContain('Circle K');
	});

	it('opens the station details with its name, brand and hours', async () => {
		const app = await renderApp({
			overpass: (request) =>
				isFuelQuery(request.query) ? [...WATER_ELEMENTS, ...FUEL_ELEMENTS] : WATER_ELEMENTS,
		});
		await waitFor(() =>
			expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + FUEL_ELEMENTS.length)
		);

		const brandedIndex = app
			.markers()
			.findIndex((marker) => marker.getAttribute('title')?.includes('Circle K') === true);
		expect(brandedIndex).toBeGreaterThanOrEqual(0);

		app.tapMarker(brandedIndex);
		await waitFor(() => expect(app.sheetText()).toContain(BRANDED_FUEL_STATION.tags.name));
		app.expandSheet();
		expect(app.sheetText()).toContain('Circle K');
		expect(app.sheetText()).toContain('24/7');
	});

	it('drops the stations when the layer is switched off and does not ask for them again', async () => {
		const app = await renderApp({
			overpass: (request) =>
				isFuelQuery(request.query) ? [...WATER_ELEMENTS, ...FUEL_ELEMENTS] : WATER_ELEMENTS,
		});
		await waitFor(() =>
			expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + FUEL_ELEMENTS.length)
		);

		app.toggleLayer('Gas Stations');

		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		expect(app.isLayerOn('Gas Stations')).toBe(false);
		expect(app.overpass.requests).toHaveLength(1);
	});
});
