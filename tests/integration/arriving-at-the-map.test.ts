import { waitFor, within } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { CACHE_TILE_ZOOM, DEFAULT_ZOOM } from '../../src/core/config';
import { tileBounds, tileOf } from '../../src/domain';
import {
	NEAREST_TAP_TO_USER,
	NON_DRINKABLE,
	RIGA,
	SEASONAL_TAP_NEAR_RIGA_CENTRE,
	USER,
	WATER_MARKER_COUNT,
} from '../fixtures';
import { bboxCenter, GEO_PERMISSION_DENIED, renderApp, unpaddedViewportBbox } from '../harness';

const maxCenterDriftFromTileRounding = (point: {
	readonly lat: number;
	readonly lon: number;
}): { lat: number; lon: number } => {
	const bounds = tileBounds(tileOf(point, CACHE_TILE_ZOOM));
	return { lat: bounds.north - bounds.south, lon: bounds.east - bounds.west };
};

const nearestIndex = (markers: readonly Element[]): number =>
	markers.findIndex((marker) => marker.classList.contains('nearest-marker'));

describe('Arriving at the map', () => {
	it('creates the map before the fix resolves, then recentres and ranks from the runner once it arrives', async () => {
		const app = await renderApp({ geolocation: { pending: true } });

		expect(app.container.classList.contains('leaflet-container')).toBe(true);
		const rigaCenter = bboxCenter(app.overpass.lastRequest().bbox);
		const rigaTolerance = maxCenterDriftFromTileRounding(RIGA);
		expect(Math.abs(rigaCenter.lat - RIGA.lat)).toBeLessThan(rigaTolerance.lat);
		expect(Math.abs(rigaCenter.lon - RIGA.lon)).toBeLessThan(rigaTolerance.lon);

		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		expect(app.userLocation()).toEqual({ markers: 0, circles: 0 });
		app.tapMarker(nearestIndex(app.markers()));
		app.expandSheet();
		await waitFor(() =>
			expect(app.sheetText()).toContain(`ID: ${SEASONAL_TAP_NEAR_RIGA_CENTRE.id}`)
		);
		app.closeSheet();

		app.geolocation.respondWith({ position: USER });

		await waitFor(() => expect(app.userLocation()).toEqual({ markers: 1, circles: 1 }));
		await waitFor(() => {
			app.tapMarker(nearestIndex(app.markers()));
			app.expandSheet();
			expect(app.sheetText()).toContain(`ID: ${NEAREST_TAP_TO_USER.id}`);
		});
	});

	it('fetches a padded area, larger than the visible viewport, so nearby panning is free', async () => {
		const app = await renderApp({ geolocation: { position: USER } });

		const padded = app.overpass.lastRequest().bbox;
		const raw = unpaddedViewportBbox(USER, DEFAULT_ZOOM);

		expect(padded.east - padded.west).toBeGreaterThan(raw.east - raw.west);
		expect(padded.north - padded.south).toBeGreaterThan(raw.north - raw.south);
	});

	it('draws the non-drinkable source with the crossed-out icon and warns in its sheet', async () => {
		const app = await renderApp();
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		const crossed = app
			.markers()
			.filter((marker) => marker.classList.contains('non-drinkable-marker'));
		expect(crossed).toHaveLength(1);

		const nonDrinkableMarker = crossed[0] as HTMLElement;
		expect(nonDrinkableMarker.getAttribute('data-facility-kind')).toBe('water');
		expect(nonDrinkableMarker.getAttribute('title')).toContain('not drinkable');

		app.tapMarker(app.markers().indexOf(crossed[0] as Element));
		app.expandSheet();
		await waitFor(() => expect(app.sheetText()).toContain('Not Drinkable'));
		expect(app.sheetText()).toContain(`ID: ${NON_DRINKABLE.id}`);
	});

	it('names every water marker with its facility kind and type, and flags the nearest one', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		for (const marker of app.markers()) {
			expect(marker.getAttribute('data-facility-kind')).toBe('water');
			expect(marker.getAttribute('data-facility-type')).not.toBeNull();
			expect(marker.getAttribute('title')).not.toBeNull();
		}

		const nearestMarker = app.markers()[nearestIndex(app.markers())] as HTMLElement;
		expect(nearestMarker.getAttribute('title')).toContain('nearest');
	});

	it('highlights the water point nearest to the visitor and describes it in its sheet', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		const index = nearestIndex(app.markers());
		expect(index).toBeGreaterThanOrEqual(0);
		expect(app.markers().filter((m) => m.classList.contains('nearest-marker'))).toHaveLength(1);

		app.tapMarker(index);
		await waitFor(() => expect(app.sheet()).not.toBeNull());
		const sheet = app.sheet() as HTMLElement;

		expect(app.sheetText()).toContain('Drinking Water');
		expect(app.sheetText()).toMatch(/\d+m · [NESW]{1,2}/);
		expect(app.sheetText()).toContain('Nearest water');
		expect(sheet.querySelector('.detail-sheet-live')?.getAttribute('aria-live')).toBe('polite');

		app.expandSheet();
		expect(app.sheetText()).toContain(`ID: ${NEAREST_TAP_TO_USER.id}`);
		expect(app.sheetText()).toContain('Data © OpenStreetMap contributors');
		expect(within(sheet).getByRole('link', { name: 'OpenStreetMap' })).toHaveProperty(
			'href',
			expect.stringContaining(`/node/${NEAREST_TAP_TO_USER.id}`)
		);
	});

	it('shows a distance chip on the nearest marker, matching the distance in its title', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		const nearestMarker = app.markers()[nearestIndex(app.markers())] as HTMLElement;
		const chip = nearestMarker.querySelector('.facility-marker-distance');
		expect(chip).not.toBeNull();
		const chipText = chip?.textContent ?? '';
		expect(chipText).toMatch(/^\d+m$|^\d+\.\d\dkm$/);
		expect(nearestMarker.getAttribute('title')).toContain(chipText);
	});

	it('falls back to Riga with a notice when the visitor denies location access, ranking nearest by distance from the map centre', async () => {
		const app = await renderApp({ geolocation: { error: GEO_PERMISSION_DENIED } });

		await waitFor(() =>
			expect(app.toasts()).toContain('Could not detect your location. Showing Riga area.')
		);
		const center = bboxCenter(app.overpass.lastRequest().bbox);
		const tolerance = maxCenterDriftFromTileRounding(RIGA);
		expect(Math.abs(center.lat - RIGA.lat)).toBeLessThan(tolerance.lat);
		expect(Math.abs(center.lon - RIGA.lon)).toBeLessThan(tolerance.lon);

		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		expect(app.userLocation()).toEqual({ markers: 0, circles: 0 });

		app.tapMarker(nearestIndex(app.markers()));
		app.expandSheet();
		await waitFor(() =>
			expect(app.sheetText()).toContain(`ID: ${SEASONAL_TAP_NEAR_RIGA_CENTRE.id}`)
		);
		expect(app.sheetText()).toContain('Water Tap');
		expect(app.sheetText()).toContain('Seasonal');
	});
});
