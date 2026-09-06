/**
 * A runner keeps the map open mid-run: the dot follows every fix, the nearest tap and the
 * HUD stay current, and tracking behaves while the runner looks away or taps the screen.
 */

import { waitFor } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { RIGA, USER } from '../fixtures';
import type { AppHandle } from '../harness';
import { renderApp } from '../harness';

const userMarker = (app: AppHandle): Element | null =>
	app.container.querySelector('.user-location-marker');

const nearestFacilityType = (app: AppHandle): string | null =>
	app
		.markers()
		.find((marker) => marker.classList.contains('nearest-marker'))
		?.getAttribute('data-facility-type') ?? null;

describe('Following my run', () => {
	it('moves the dot in place as fixes arrive and shows the heading cone while moving', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.userLocation()).toEqual({ markers: 1, circles: 1 }));
		expect(userMarker(app)?.getAttribute('data-moving')).toBe('false');

		app.geolocation.moveTo({ lat: USER.lat + 0.0003, lon: USER.lon, speed: 2, heading: 90 });

		await waitFor(() => expect(userMarker(app)?.getAttribute('data-moving')).toBe('true'));
		expect(app.userLocation()).toEqual({ markers: 1, circles: 1 });
	});

	it('updates the nearest-water HUD and beeline on every fix, however small the move', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.hud()).toContain('Nearest water'));
		expect(app.beelineVisible()).toBe(true);
		const before = app.hud();

		app.geolocation.moveTo({ lat: USER.lat + 0.00005, lon: USER.lon });

		await waitFor(() => expect(app.hud()).not.toBe(before));
		expect(app.beelineVisible()).toBe(true);
	});

	it('re-ranks the nearest point only after moving 25 m, skipping while a popup is open and catching up once it closes', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(nearestFacilityType(app)).toBe('drinking_water'));

		const nonDrinkableIndex = app
			.markers()
			.findIndex((marker) => marker.classList.contains('non-drinkable-marker'));
		app.openPopupOf(nonDrinkableIndex);
		await waitFor(() => expect(app.popup()).not.toBeNull());

		app.geolocation.moveTo({ lat: RIGA.lat, lon: RIGA.lon });
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(nearestFacilityType(app)).toBe('drinking_water');

		app.closePopup();
		await waitFor(() => expect(nearestFacilityType(app)).toBe('water_tap'));
	});

	it('leaves follow mode on a keyboard pan, and the locate button re-enters it', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.locateButton().getAttribute('data-follow')).toBe('on'));

		await app.pressArrowKey('right');

		await waitFor(() => expect(app.locateButton().getAttribute('data-follow')).toBe('off'));
		expect(app.locateButton().getAttribute('aria-pressed')).toBe('false');

		app.clickLocate();

		await waitFor(() => expect(app.locateButton().getAttribute('data-follow')).toBe('on'));
	});

	it('turns the dot stale after 30 s without a fix, and live again on the next one', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(userMarker(app)?.getAttribute('data-freshness')).toBe('live'));

		await vi.advanceTimersByTimeAsync(30_000);
		expect(userMarker(app)?.getAttribute('data-freshness')).toBe('stale');

		app.geolocation.moveTo({ lat: USER.lat, lon: USER.lon });
		await waitFor(() => expect(userMarker(app)?.getAttribute('data-freshness')).toBe('live'));
	});

	it('stops watching while the tab is hidden and resumes once it is visible again', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.geolocation.watchers).toBeGreaterThan(0));

		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
		await waitFor(() => expect(app.geolocation.watchers).toBe(0));

		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
		await waitFor(() => expect(app.geolocation.watchers).toBeGreaterThan(0));
	});
});
