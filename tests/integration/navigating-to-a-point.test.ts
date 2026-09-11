import { waitFor, within } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { NEAREST_TAP_TO_USER, USER, WATER_MARKER_COUNT } from '../fixtures';
import { renderApp } from '../harness';

const SETTLE_MS = 400;

describe('Navigating to a point from its sheet', () => {
	it('offers a walking-directions link for the coordinates of the point that opens in a new tab', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		app.tapMarker(app.markers().findIndex((m) => m.classList.contains('nearest-marker')));
		app.expandSheet();
		await waitFor(() => expect(app.sheetText()).toContain(`ID: ${NEAREST_TAP_TO_USER.id}`));
		const link = within(app.sheet() as HTMLElement).getByRole('link', {
			name: /walking directions/,
		});

		expect(link.getAttribute('href')).toContain(
			`${NEAREST_TAP_TO_USER.lat},${NEAREST_TAP_TO_USER.lon}`
		);
		expect(link.getAttribute('href')).toContain('travelmode=walking');
		expect(link.getAttribute('target')).toBe('_blank');
		expect(link.getAttribute('rel')).toBe('noopener noreferrer');
	});
});

describe('Keeping a sheet open', () => {
	it('keeps the sheet open when the map settles again over the same points', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		app.tapMarker(app.markers().findIndex((m) => m.classList.contains('nearest-marker')));
		app.expandSheet();
		await waitFor(() => expect(app.sheetText()).toContain(`ID: ${NEAREST_TAP_TO_USER.id}`));
		const requestsBefore = app.overpass.requests.length;

		await app.pan('right', { far: false });
		await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

		expect(app.overpass.requests).toHaveLength(requestsBefore);
		expect(app.sheetText()).toContain(`ID: ${NEAREST_TAP_TO_USER.id}`);
	});
});
