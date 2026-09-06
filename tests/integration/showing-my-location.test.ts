import { waitFor } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { USER } from '../fixtures';
import { GEO_PERMISSION_DENIED, GEO_POSITION_UNAVAILABLE, renderApp } from '../harness';

const PERMISSION_DENIED_MESSAGE =
	'Permission to access location was denied. Check your browser site settings and allow location access.';
const FALLBACK_MESSAGE = 'Could not detect your location. Showing Riga area.';

describe('Showing my location', () => {
	it('shows a single dot however often the button is pressed, with no success toast', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.userLocation()).toEqual({ markers: 1, circles: 1 }));

		app.clickLocate();
		app.clickLocate();

		expect(app.userLocation()).toEqual({ markers: 1, circles: 1 });
		expect(app.toasts()).toHaveLength(0);
		await app.settled();
	});

	it('shows the blocked state on denial, with only the generic fallback toast at startup', async () => {
		const app = await renderApp({ geolocation: { error: GEO_PERMISSION_DENIED } });

		await waitFor(() => expect(app.locateButton().getAttribute('data-state')).toBe('blocked'));
		expect(app.locateButton().getAttribute('aria-label')).toContain('blocked');
		expect(app.toasts()).toContain(FALLBACK_MESSAGE);
		expect(app.toasts()).not.toContain(PERMISSION_DENIED_MESSAGE);
	});

	it('retries on press and shows the permission error only for that explicit press', async () => {
		const app = await renderApp({ geolocation: { error: GEO_PERMISSION_DENIED } });
		await waitFor(() => expect(app.locateButton().getAttribute('data-state')).toBe('blocked'));

		app.clickLocate();

		await waitFor(() => expect(app.toasts()).toContain(PERMISSION_DENIED_MESSAGE));
	});

	it('starts tracking and enters follow mode once permission is granted on retry', async () => {
		const app = await renderApp({ geolocation: { error: GEO_PERMISSION_DENIED } });
		await waitFor(() => expect(app.locateButton().getAttribute('data-state')).toBe('blocked'));

		app.geolocation.respondWith({ position: USER });
		app.clickLocate();

		await waitFor(() => expect(app.userLocation()).toEqual({ markers: 1, circles: 1 }));
		expect(app.locateButton().getAttribute('data-follow')).toBe('on');
		expect(app.toasts().some((toast) => toast.includes('Location found'))).toBe(false);
	});

	it('leaves follow mode on press while tracking continues, and re-enters it on the next press', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.locateButton().getAttribute('data-follow')).toBe('on'));

		app.clickLocate();
		expect(app.locateButton().getAttribute('data-state')).toBe('tracking');
		expect(app.locateButton().getAttribute('aria-pressed')).toBe('false');

		app.clickLocate();
		expect(app.locateButton().getAttribute('aria-pressed')).toBe('true');
	});

	it('shows an error toast for an explicit press that fails, never for the silent startup attempt', async () => {
		const app = await renderApp({ geolocation: { error: GEO_POSITION_UNAVAILABLE } });
		await waitFor(() => expect(app.locateButton().getAttribute('data-state')).toBe('failed'));
		expect(app.toasts()).not.toContain('Location information is unavailable.');

		app.clickLocate();

		await waitFor(() => expect(app.toasts()).toContain('Location information is unavailable.'));
	});

	it('ignores a fix with an invalid accuracy and keeps showing the next good one', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		await waitFor(() => expect(app.hud()).toContain('Nearest water'));
		const before = app.hud();

		app.geolocation.moveTo({ lat: USER.lat + 0.01, lon: USER.lon, accuracy: Number.NaN });
		await app.settled();
		expect(app.hud()).toBe(before);

		app.geolocation.moveTo({ lat: USER.lat + 0.01, lon: USER.lon, accuracy: -1 });
		await app.settled();
		expect(app.hud()).toBe(before);

		app.geolocation.moveTo({ lat: USER.lat + 0.01, lon: USER.lon, accuracy: 15 });
		await waitFor(() => expect(app.hud()).not.toBe(before));
		expect(app.userLocation()).toEqual({ markers: 1, circles: 1 });
	});
});
