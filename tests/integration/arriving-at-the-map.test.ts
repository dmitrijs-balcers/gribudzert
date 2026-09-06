import { waitFor, within } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { CACHE_TILE_ZOOM, DEFAULT_ZOOM } from '../../src/core/config';
import { tileBounds, tileOf } from '../../src/domain';
import {
	NEAREST_TO_USER,
	NON_DRINKABLE,
	RIGA,
	SEASONAL_TAP,
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
	it('centres on the visitor and shows the water points around them', async () => {
		const app = await renderApp({ geolocation: { position: USER } });

		const center = bboxCenter(app.overpass.lastRequest().bbox);
		const tolerance = maxCenterDriftFromTileRounding(USER);
		expect(Math.abs(center.lat - USER.lat)).toBeLessThan(tolerance.lat);
		expect(Math.abs(center.lon - USER.lon)).toBeLessThan(tolerance.lon);

		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		expect(app.userLocation()).toEqual({ markers: 1, circles: 1 });
	});

	it('fetches a padded area, larger than the visible viewport, so nearby panning is free', async () => {
		const app = await renderApp({ geolocation: { position: USER } });

		const padded = app.overpass.lastRequest().bbox;
		const raw = unpaddedViewportBbox(USER, DEFAULT_ZOOM);

		expect(padded.east - padded.west).toBeGreaterThan(raw.east - raw.west);
		expect(padded.north - padded.south).toBeGreaterThan(raw.north - raw.south);
	});

	it('draws the non-drinkable source with the crossed-out icon and warns in its popup', async () => {
		const app = await renderApp();
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		const crossed = app
			.markers()
			.filter((marker) => marker.classList.contains('non-drinkable-marker'));
		expect(crossed).toHaveLength(1);

		const nonDrinkableMarker = crossed[0] as HTMLElement;
		expect(nonDrinkableMarker.getAttribute('data-facility-kind')).toBe('water');
		expect(nonDrinkableMarker.getAttribute('title')).toContain('not drinkable');

		app.openPopupOf(app.markers().indexOf(crossed[0] as Element));
		await waitFor(() => expect(app.popupText()).toContain('Not Drinkable'));
		expect(app.popupText()).toContain(`ID: ${NON_DRINKABLE.id}`);
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

	it('highlights the water point nearest to the visitor and describes it in its popup', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		const index = nearestIndex(app.markers());
		expect(index).toBeGreaterThanOrEqual(0);
		expect(app.markers().filter((m) => m.classList.contains('nearest-marker'))).toHaveLength(1);

		app.openPopupOf(index);
		await waitFor(() => expect(app.popup()).not.toBeNull());
		const popup = app.popup() as HTMLElement;

		expect(app.popupText()).toContain('Drinking Water');
		expect(app.popupText()).toContain(`ID: ${NEAREST_TO_USER.id}`);
		expect(app.popupText()).toMatch(/Distance: \d+m/);
		expect(app.popupText()).toContain('Nearest water point');
		expect(within(popup).getByRole('link', { name: 'Open on OpenStreetMap' })).toHaveProperty(
			'href',
			expect.stringContaining(`/node/${NEAREST_TO_USER.id}`)
		);
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

		app.openPopupOf(nearestIndex(app.markers()));
		await waitFor(() => expect(app.popupText()).toContain(`ID: ${SEASONAL_TAP.id}`));
		expect(app.popupText()).toContain('Water Tap');
		expect(app.popupText()).toContain('Seasonal: yes');
	});
});
