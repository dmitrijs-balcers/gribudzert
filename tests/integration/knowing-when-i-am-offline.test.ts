/**
 * The offline status chip: a standing indicator ("Offline · showing saved points") appears
 * the moment there is no connection — whether that is true from the first frame or only
 * becomes true mid-session — and clears the instant the connection returns, handing off to
 * the passing "Back online." toast.
 */

import { waitFor } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../harness';

const OFFLINE_STATUS_MESSAGE = 'Offline · showing saved points';
const BACK_ONLINE_MESSAGE = 'Back online.';

describe('Knowing when I am offline', () => {
	it('shows the status chip and no toast when starting offline', async () => {
		const app = await renderApp({ connectivity: 'offline' });

		await waitFor(() => expect(app.status()).toBe(OFFLINE_STATUS_MESSAGE));
		// The status chip is the only visible notice; no passing toast accompanies it.
		expect(app.toasts()).toEqual([OFFLINE_STATUS_MESSAGE]);
	});

	it('shows the status chip when the connection drops mid-session', async () => {
		const app = await renderApp();
		expect(app.status()).toBeNull();

		app.goOffline();

		await waitFor(() => expect(app.status()).toBe(OFFLINE_STATUS_MESSAGE));
	});

	it('clears the status chip and shows a toast when the connection comes back', async () => {
		const app = await renderApp({ connectivity: 'offline' });
		await waitFor(() => expect(app.status()).toBe(OFFLINE_STATUS_MESSAGE));

		app.goOnline();

		await waitFor(() => expect(app.status()).toBeNull());
		await waitFor(() => expect(app.toasts()).toContain(BACK_ONLINE_MESSAGE));
	});
});
