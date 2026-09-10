/**
 * The mobile "install this app" nudge: quiet on a first visit, offered from the second
 * visit onward, and never pushy — it steps aside for anyone already installed, on
 * desktop, or who recently said no.
 */

import type { PWAInstallElement } from '@khmyznikov/pwa-install';
import { describe, expect, it, vi } from 'vitest';
import { INSTALL_PROMPT_SHOW_DELAY_MS } from '../../src/core/config';
import { GEO_PERMISSION_DENIED, renderApp } from '../harness';

type TrackerWindow = Window & { umami?: { track: (...args: unknown[]) => void } };

const SHOW_DELAY_MARGIN_MS = 300;

const waitPastShowDelay = (): Promise<void> =>
	new Promise((resolve) =>
		setTimeout(resolve, INSTALL_PROMPT_SHOW_DELAY_MS + SHOW_DELAY_MARGIN_MS)
	);

const installDialog = (): PWAInstallElement | null =>
	document.querySelector<PWAInstallElement>('pwa-install');

const dispatchUserChoice = (dialog: Element, message: 'accepted' | 'dismissed'): void => {
	dialog.dispatchEvent(new CustomEvent('pwa-user-choice-result-event', { detail: { message } }));
};

const markInstallAvailable = (): void => {
	const dialog = installDialog();
	if (dialog === null) {
		throw new Error('Install dialog element was not mounted');
	}
	dialog.isInstallAvailable = true;
};

const DENIED_LOCATION = { error: GEO_PERMISSION_DENIED } as const;

const MOBILE = { pointer: 'coarse', geolocation: DENIED_LOCATION } as const;
const DESKTOP = { pointer: 'fine', geolocation: DENIED_LOCATION } as const;
const STANDALONE = { displayMode: 'standalone', geolocation: DENIED_LOCATION } as const;

describe('Inviting to install the app', () => {
	it('does not show the install dialog on a first mobile visit', async () => {
		await renderApp(MOBILE);

		await waitPastShowDelay();
		expect(installDialog()).toBeNull();
	});

	it('shows the install dialog from the second mobile visit onward', async () => {
		const track = vi.fn();
		(window as TrackerWindow).umami = { track };

		await renderApp(MOBILE);
		expect(installDialog()).toBeNull();

		await renderApp({ ...MOBILE, reload: true });
		markInstallAvailable();

		await waitPastShowDelay();
		const dialog = installDialog();
		if (dialog === null) {
			throw new Error('Install dialog did not appear on the second visit');
		}
		expect(dialog.isDialogHidden).toBe(false);
		expect(track).toHaveBeenCalledWith('install_prompt_shown');

		dispatchUserChoice(dialog, 'accepted');
		expect(track).toHaveBeenCalledWith('install_prompt_accepted');
	}, 15_000);

	it('stays quiet when the platform never says the app can be installed', async () => {
		const track = vi.fn();
		(window as TrackerWindow).umami = { track };

		await renderApp(MOBILE);

		await renderApp({ ...MOBILE, reload: true });

		await waitPastShowDelay();
		expect(installDialog()?.isInstallAvailable).toBe(false);
		expect(track).not.toHaveBeenCalledWith('install_prompt_shown');
	}, 15_000);

	it('never shows the install dialog while running in standalone display mode', async () => {
		await renderApp(STANDALONE);
		expect(installDialog()).toBeNull();

		await renderApp({ ...STANDALONE, reload: true });
		await waitPastShowDelay();
		expect(installDialog()).toBeNull();
	}, 15_000);

	it('never shows the install dialog on a desktop viewport', async () => {
		await renderApp(DESKTOP);

		await renderApp({ ...DESKTOP, reload: true });
		await waitPastShowDelay();
		expect(installDialog()).toBeNull();
	}, 15_000);

	it('does not show the install dialog again within 14 days of a dismissal', async () => {
		const track = vi.fn();
		(window as TrackerWindow).umami = { track };

		await renderApp(MOBILE);
		expect(installDialog()).toBeNull();

		await renderApp({ ...MOBILE, reload: true });
		markInstallAvailable();
		await waitPastShowDelay();
		const dialog = installDialog();
		if (dialog === null) {
			throw new Error('Install dialog did not appear on the second visit');
		}
		dispatchUserChoice(dialog, 'dismissed');
		expect(track).toHaveBeenCalledWith('install_prompt_dismissed');

		await renderApp({ ...MOBILE, reload: true });
		await waitPastShowDelay();
		expect(installDialog()).toBeNull();
	}, 20_000);
});
