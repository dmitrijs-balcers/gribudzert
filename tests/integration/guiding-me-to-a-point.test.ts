import { waitFor } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { GUIDANCE_WAITING_FOR_LOCATION_MESSAGE } from '../../src/app/messages';
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

const guideToTheNonDrinkableTap = async (app: AppHandle): Promise<void> => {
	await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
	const nonDrinkableIndex = app
		.markers()
		.findIndex((marker) => marker.classList.contains('non-drinkable-marker'));
	app.openPopupOf(nonDrinkableIndex);
	await waitFor(() => expect(app.popupText()).toContain(`ID: ${NON_DRINKABLE.id}`));

	app.guideFromPopup();
};

describe('Guiding me to a point', () => {
	it('swings the HUD and beeline to the chosen water point and closes its popup', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.hud()).toContain('Nearest water'));

		await guideToTheNonDrinkableTap(app);

		await waitFor(() => expect(app.popup()).toBeNull());
		expect(app.hud()).toContain('Guiding to');
		expect(app.beelineVisible()).toBe(true);
	});

	it('goes back to the nearest water point when the visitor stops guiding', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await guideToTheNonDrinkableTap(app);
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
		app.guideFromPopup();
		await waitFor(() => expect(app.hud()).toContain('Guiding to Public Toilet'));

		app.toggleLayer('Public Toilets');

		await waitFor(() => expect(app.hud()).toContain('Nearest water'));
	});

	it('waits for the location when none is known yet, then starts guiding', async () => {
		const app = await renderApp({ geolocation: { pending: true } });
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		app.openPopupOf(0);
		await waitFor(() => expect(app.popup()).not.toBeNull());

		app.guideFromPopup();

		await waitFor(() => expect(app.popup()).toBeNull());
		expect(app.hud()).toBeNull();
		expect(app.toastHistory()).toContain(GUIDANCE_WAITING_FOR_LOCATION_MESSAGE);

		app.geolocation.moveTo(USER);

		await waitFor(() => expect(app.hud()).toContain('Guiding to'));
		expect(app.beelineVisible()).toBe(true);
	});

	it('opens the chosen point when the visitor taps the HUD', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await guideToTheNonDrinkableTap(app);
		await waitFor(() => expect(app.popup()).toBeNull());

		app.clickHud();

		await waitFor(() => expect(app.popupText()).toContain(`ID: ${NON_DRINKABLE.id}`));
	});
});
