/**
 * A visitor presses "Show my location": the map marks where they are, exactly once, and
 * explains when the browser cannot tell.
 */

import { waitFor } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { USER } from '../fixtures';
import { GEO_PERMISSION_DENIED, GEO_POSITION_UNAVAILABLE, renderApp } from '../harness';

describe('Showing my location', () => {
	it('shows a single position marker and accuracy circle however often it is pressed', async () => {
		const app = await renderApp({ geolocation: { position: USER } });
		expect(app.userLocation()).toEqual({ markers: 1, circles: 1 });

		app.clickLocate();
		await waitFor(() =>
			expect(app.toasts()).toContain('Location found! Centered on your position.')
		);
		app.clickLocate();
		await waitFor(() => expect(app.geolocation.requests).toBe(3));

		await waitFor(() => expect(app.popupText()).toContain('You are here'));
		expect(app.userLocation()).toEqual({ markers: 1, circles: 1 });
		await app.settled();
	});

	it('places the marker once location is granted after being denied at first', async () => {
		const app = await renderApp({ geolocation: { error: GEO_PERMISSION_DENIED } });
		expect(app.userLocation()).toEqual({ markers: 0, circles: 0 });

		app.geolocation.respondWith({ position: USER });
		app.clickLocate();

		await waitFor(() => expect(app.userLocation()).toEqual({ markers: 1, circles: 1 }));
		await app.settled();
	});

	it('explains when the browser cannot provide a position', async () => {
		const app = await renderApp({ geolocation: { position: USER } });

		app.geolocation.respondWith({ error: GEO_POSITION_UNAVAILABLE });
		app.clickLocate();

		await waitFor(() => expect(app.toasts()).toContain('Location information is unavailable.'));
		expect(app.userLocation()).toEqual({ markers: 1, circles: 1 });
	});
});
