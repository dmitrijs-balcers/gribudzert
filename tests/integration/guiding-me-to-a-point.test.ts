import { waitFor } from '@testing-library/dom';
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
	app.openPopupOf(nonDrinkableIndex);
	await waitFor(() => expect(app.popupText()).toContain(`ID: ${NON_DRINKABLE.id}`));
};

describe('Guiding me to a point', () => {
	it('swings the HUD and beeline to a tapped water point while its popup stays open', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.hud()).toContain('Nearest water'));

		await tapTheNonDrinkableTap(app);

		await waitFor(() => expect(app.hud()).toContain('Guiding to'));
		expect(app.popup()).not.toBeNull();
		expect(app.beelineVisible()).toBe(true);
	});

	it('keeps guiding to the tapped point after its popup is closed', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await tapTheNonDrinkableTap(app);
		await waitFor(() => expect(app.hud()).toContain('Guiding to'));

		app.closePopup();

		await waitFor(() => expect(app.popup()).toBeNull());
		expect(app.hud()).toContain('Guiding to');
	});

	it('goes back to the nearest water point when the visitor stops guiding', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await tapTheNonDrinkableTap(app);
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
		app.openPopupOf(app.markers().length - 1);
		await waitFor(() => expect(app.popupText()).toContain(`ID: ${ACCESSIBLE_TOILET.id}`));
		await waitFor(() => expect(app.hud()).toContain('Guiding to Public Toilet'));

		app.toggleLayer('Public Toilets');

		await waitFor(() => expect(app.hud()).toContain('Nearest water'));
	});

	it('remembers a point tapped before the location is known and guides once it arrives', async () => {
		const app = await renderApp({ geolocation: { pending: true } });
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		app.openPopupOf(0);

		await waitFor(() => expect(app.popup()).not.toBeNull());
		expect(app.hud()).toBeNull();
		expect(app.toastHistory()).toHaveLength(0);

		app.geolocation.moveTo(USER);

		await waitFor(() => expect(app.hud()).toContain('Guiding to'));
		expect(app.beelineVisible()).toBe(true);
	});

	it('opens the guided point when the visitor taps the HUD', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await tapTheNonDrinkableTap(app);
		await waitFor(() => expect(app.hud()).toContain('Guiding to'));
		app.closePopup();
		await waitFor(() => expect(app.popup()).toBeNull());

		app.clickHud();

		await waitFor(() => expect(app.popupText()).toContain(`ID: ${NON_DRINKABLE.id}`));
	});
});
