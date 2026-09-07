/**
 * The mobile "install this app" nudge: quiet on a first visit, offered from the second
 * visit onward, and never pushy — it steps aside for anyone already installed, on
 * desktop, or who recently said no.
 */

import { describe, expect, it, vi } from 'vitest';
import type { PWAInstallElement } from '@khmyznikov/pwa-install';
import { INSTALL_PROMPT_SHOW_DELAY_MS } from '../../src/core/config';
import { GEO_PERMISSION_DENIED, renderApp } from '../harness';

type TrackerWindow = Window & { umami?: { track: (...args: unknown[]) => void } };

const SHOW_DELAY_MARGIN_MS = 300;

const waitPastShowDelay = (): Promise<void> =>
	new Promise((resolve) =>
		setTimeout(resolve, INSTALL_PROMPT_SHOW_DELAY_MS + SHOW_DELAY_MARGIN_MS)
	);

const stubMatchMedia = (isMatch: (query: string) => boolean): void => {
	window.matchMedia = (query: string): MediaQueryList =>
		({
			matches: isMatch(query),
			media: query,
			onchange: null,
			addListener: () => undefined,
			removeListener: () => undefined,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
			dispatchEvent: () => false,
		}) as MediaQueryList;
};

const stubMobileViewport = (): void => stubMatchMedia((query) => query.includes('pointer: coarse'));

const stubDesktopViewport = (): void => stubMatchMedia(() => false);

const stubStandaloneDisplayMode = (): void =>
	stubMatchMedia((query) => query.includes('display-mode: standalone'));

const installDialog = (): PWAInstallElement | null =>
	document.querySelector<PWAInstallElement>('pwa-install');

const dispatchUserChoice = (dialog: Element, message: 'accepted' | 'dismissed'): void => {
	dialog.dispatchEvent(new CustomEvent('pwa-user-choice-result-event', { detail: { message } }));
};

const DENIED_LOCATION = { error: GEO_PERMISSION_DENIED } as const;

describe('Inviting to install the app', () => {
	it('does not show the install dialog on a first mobile visit', async () => {
		stubMobileViewport();
		await renderApp({ geolocation: DENIED_LOCATION });

		await waitPastShowDelay();
		expect(installDialog()).toBeNull();
	});

	it('shows the install dialog from the second mobile visit onward', async () => {
		const track = vi.fn();
		(window as TrackerWindow).umami = { track };

		stubMobileViewport();
		await renderApp({ geolocation: DENIED_LOCATION });
		expect(installDialog()).toBeNull();

		stubMobileViewport();
		await renderApp({ reload: true, geolocation: DENIED_LOCATION });

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

	it('never shows the install dialog while running in standalone display mode', async () => {
		stubStandaloneDisplayMode();
		await renderApp({ geolocation: DENIED_LOCATION });
		expect(installDialog()).toBeNull();

		stubStandaloneDisplayMode();
		await renderApp({ reload: true, geolocation: DENIED_LOCATION });
		await waitPastShowDelay();
		expect(installDialog()).toBeNull();
	}, 15_000);

	it('never shows the install dialog on a desktop viewport', async () => {
		stubDesktopViewport();
		await renderApp({ geolocation: DENIED_LOCATION });

		stubDesktopViewport();
		await renderApp({ reload: true, geolocation: DENIED_LOCATION });
		await waitPastShowDelay();
		expect(installDialog()).toBeNull();
	}, 15_000);

	it('does not show the install dialog again within 14 days of a dismissal', async () => {
		const track = vi.fn();
		(window as TrackerWindow).umami = { track };

		stubMobileViewport();
		await renderApp({ geolocation: DENIED_LOCATION });
		expect(installDialog()).toBeNull();

		stubMobileViewport();
		await renderApp({ reload: true, geolocation: DENIED_LOCATION });
		await waitPastShowDelay();
		const dialog = installDialog();
		if (dialog === null) {
			throw new Error('Install dialog did not appear on the second visit');
		}
		dispatchUserChoice(dialog, 'dismissed');
		expect(track).toHaveBeenCalledWith('install_prompt_dismissed');

		stubMobileViewport();
		await renderApp({ reload: true, geolocation: DENIED_LOCATION });
		await waitPastShowDelay();
		expect(installDialog()).toBeNull();
	}, 20_000);
});
