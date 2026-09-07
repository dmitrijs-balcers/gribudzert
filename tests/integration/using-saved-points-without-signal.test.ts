import { waitFor } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { WATER_MARKER_COUNT } from '../fixtures';
import type { AppHandle } from '../harness';
import { GEO_PERMISSION_DENIED, renderApp } from '../harness';

const BACK_ONLINE_MESSAGE = 'Back online.';
const OFFLINE_SHOWING_SAVED = "Couldn't refresh map data. Showing saved points.";
const NETWORK_ERROR =
	'Failed to load water points. Please check your internet connection and try again.';

const PAN_SETTLE_MS = 750;

const panRightAndSettle = async (app: AppHandle): Promise<void> => {
	await app.pan('right');
	await new Promise((resolve) => setTimeout(resolve, PAN_SETTLE_MS));
};

describe('Using saved points without a signal', () => {
	it('shows saved points and marks the pill offline when starting with no connection', async () => {
		const first = await renderApp({ geolocation: { error: GEO_PERMISSION_DENIED } });
		await waitFor(() => expect(first.markers()).toHaveLength(WATER_MARKER_COUNT));

		const app = await renderApp({
			reload: true,
			connectivity: 'offline',
			geolocation: { error: GEO_PERMISSION_DENIED },
		});

		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		await waitFor(() => expect(app.provenance()).toBe('offline'));
		expect(app.overpass.requests).toHaveLength(0);
	});

	it('marks the pill offline and asks Overpass for nothing when starting offline with nothing saved', async () => {
		const app = await renderApp({ connectivity: 'offline' });

		await waitFor(() => expect(app.provenance()).toBe('offline'));
		expect(app.overpass.requests).toHaveLength(0);
		expect(app.markers()).toHaveLength(0);
		expect(app.toasts()).not.toContain(NETWORK_ERROR);
		expect(app.toasts()).not.toContain(OFFLINE_SHOWING_SAVED);
	});

	it('goes quiet and stays quiet when the connection drops mid-session', async () => {
		const app = await renderApp();
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		const requestsBeforeGoingOffline = app.overpass.requests.length;

		app.goOffline();
		await waitFor(() => expect(app.provenance()).toBe('offline'));
		expect(app.loadingVisible()).toBe(false);

		await panRightAndSettle(app);

		expect(app.overpass.requests).toHaveLength(requestsBeforeGoingOffline);
		expect(app.provenance()).toBe('offline');
	});

	it('tells the visitor and refreshes the map when the connection comes back', async () => {
		const app = await renderApp({ connectivity: 'offline' });
		await waitFor(() => expect(app.provenance()).toBe('offline'));
		expect(app.overpass.requests).toHaveLength(0);

		app.goOnline();

		await waitFor(() => expect(app.toasts()).toContain(BACK_ONLINE_MESSAGE));
		await waitFor(() => expect(app.overpass.requests.length).toBeGreaterThan(0));
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
		await waitFor(() => expect(app.provenance()).toBe('live'));
	});
});
