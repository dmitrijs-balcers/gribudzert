import { fireEvent, waitFor } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import {
	ACCESSIBLE_TOILET,
	isToiletQuery,
	NON_DRINKABLE,
	TOILET_ELEMENTS,
	USER,
	WATER_ELEMENTS,
	WATER_MARKER_COUNT,
} from '../fixtures';
import type { AppHandle } from '../harness';
import { renderApp } from '../harness';

const tapTheNonDrinkableTap = async (app: AppHandle): Promise<void> => {
	await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
	const nonDrinkableIndex = app
		.markers()
		.findIndex((marker) => marker.classList.contains('non-drinkable-marker'));
	app.tapMarker(nonDrinkableIndex);
	app.expandSheet();
	await waitFor(() => expect(app.sheetText()).toContain(`ID: ${NON_DRINKABLE.id}`));
};

describe('Guiding me to a point', () => {
	it('swings the beeline to a tapped water point and lets the sheet take over from the HUD', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.hud()).toContain('Nearest water'));

		await tapTheNonDrinkableTap(app);

		expect(app.sheet()).not.toBeNull();
		expect(app.hud()).toBeNull();
		expect(app.sheetText()).toMatch(/\d+m · [NESW]{1,2}/);
		expect(app.beelineVisible()).toBe(true);
	});

	it('keeps guiding to the tapped point after its sheet is closed, bringing the HUD back', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await tapTheNonDrinkableTap(app);
		expect(app.hud()).toBeNull();

		app.closeSheet();

		await waitFor(() => expect(app.sheet()).toBeNull());
		expect(app.hud()).toContain('Guiding to');
		expect(app.beelineVisible()).toBe(true);
	});

	it('marks the tapped point on the map while its sheet is open', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await tapTheNonDrinkableTap(app);

		const selected = app
			.markers()
			.filter((marker) => marker.classList.contains('facility-marker--selected'));
		expect(selected).toHaveLength(1);
		expect(selected[0]?.classList.contains('non-drinkable-marker')).toBe(true);

		app.closeSheet();

		await waitFor(() =>
			expect(
				app.markers().filter((marker) => marker.classList.contains('facility-marker--selected'))
			).toHaveLength(0)
		);
	});

	it('goes back to the nearest water point when the visitor stops guiding', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await tapTheNonDrinkableTap(app);
		app.closeSheet();
		await waitFor(() => expect(app.hud()).toContain('Guiding to'));

		app.stopGuiding();

		expect(app.hud()).toContain('Nearest water');
		expect(app.beelineVisible()).toBe(true);
	});

	it('stops guiding to a toilet once the toilets layer is switched off', async () => {
		const app = await renderApp({
			geolocation: { position: USER },
			overpass: (request) => (isToiletQuery(request.query) ? TOILET_ELEMENTS : WATER_ELEMENTS),
		});
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		app.toggleLayer('Public Toilets');
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + 1));
		app.tapMarker(app.markers().length - 1);
		app.expandSheet();
		await waitFor(() => expect(app.sheetText()).toContain(`ID: ${ACCESSIBLE_TOILET.id}`));
		app.closeSheet();
		await waitFor(() => expect(app.hud()).toContain('Guiding to Public Toilet'));

		app.toggleLayer('Public Toilets');

		await waitFor(() => expect(app.hud()).toContain('Nearest water'));
	});

	it('closes the sheet of a toilet once the toilets layer is switched off', async () => {
		const app = await renderApp({
			geolocation: { position: USER },
			overpass: (request) => (isToiletQuery(request.query) ? TOILET_ELEMENTS : WATER_ELEMENTS),
		});
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		app.toggleLayer('Public Toilets');
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + 1));
		app.tapMarker(app.markers().length - 1);
		await waitFor(() => expect(app.sheetText()).toContain('Public Toilet'));

		app.toggleLayer('Public Toilets');

		await waitFor(() => expect(app.sheet()).toBeNull());
		await waitFor(() => expect(app.hud()).toContain('Nearest water'));
	});

	it('remembers a point tapped before the location is known and guides once it arrives', async () => {
		const app = await renderApp({ geolocation: { pending: true } });
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		app.tapMarker(0);

		await waitFor(() => expect(app.sheet()).not.toBeNull());
		expect(app.hud()).toBeNull();
		expect(app.sheetText()).not.toMatch(/[NESW]{1,2}$/);
		expect(app.toastHistory()).toHaveLength(0);

		app.geolocation.moveTo(USER);

		await waitFor(() => expect(app.beelineVisible()).toBe(true));
		await waitFor(() => expect(app.sheetText()).toMatch(/\d+m · [NESW]{1,2}/));
		app.closeSheet();
		await waitFor(() => expect(app.hud()).toContain('Guiding to'));
	});

	it('opens the guided point when the visitor taps the HUD', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await tapTheNonDrinkableTap(app);
		app.closeSheet();
		await waitFor(() => expect(app.sheet()).toBeNull());
		await waitFor(() => expect(app.hud()).toContain('Guiding to'));

		app.clickHud();

		await waitFor(() => expect(app.sheet()).not.toBeNull());
		app.expandSheet();
		expect(app.sheetText()).toContain(`ID: ${NON_DRINKABLE.id}`);
		expect(app.hud()).toBeNull();
	});

	it('closes the sheet on Escape, on a map tap and on browser back, keeping focus sensible', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await tapTheNonDrinkableTap(app);
		const sheet = app.sheet() as HTMLElement;
		expect(sheet.getAttribute('role')).toBe('dialog');
		expect(sheet.hasAttribute('aria-modal')).toBe(false);
		const title = sheet.querySelector('.detail-sheet-title') as HTMLElement;
		expect(sheet.getAttribute('aria-labelledby')).toBe(title.id);
		expect(document.activeElement).toBe(title);

		fireEvent.keyDown(title, { key: 'Escape' });
		await waitFor(() => expect(app.sheet()).toBeNull());
		expect(app.hud()).toContain('Guiding to');

		await tapTheNonDrinkableTap(app);
		fireEvent.click(app.container);
		await waitFor(() => expect(app.sheet()).toBeNull());

		await tapTheNonDrinkableTap(app);
		history.back();
		await waitFor(() => expect(app.sheet()).toBeNull());
		expect(app.hud()).toContain('Guiding to');
	});
});
