/**
 * Mobile "install this app" prompt.
 *
 * Wraps the @khmyznikov/pwa-install web component in manual mode: the
 * component never decides on its own when to appear, we do. It is shown at
 * most once per session, only to mobile visitors who are not already running
 * the installed app, only from their second visit onward, and never again
 * within 14 days of a dismissal or after a successful install.
 */

import '@khmyznikov/pwa-install';
import type { PWAInstallElement } from '@khmyznikov/pwa-install';
import {
	trackInstallPromptAccepted,
	trackInstallPromptDismissed,
	trackInstallPromptShown,
} from '../analytics';
import {
	INSTALL_PROMPT_DISMISS_COOLDOWN_MS,
	INSTALL_PROMPT_MIN_VISITS,
	INSTALL_PROMPT_SHOW_DELAY_MS,
	INSTALL_PROMPT_STORAGE_PREFIX,
} from '../core/config';

const VISITS_KEY = `${INSTALL_PROMPT_STORAGE_PREFIX}:visits`;
const DISMISSED_AT_KEY = `${INSTALL_PROMPT_STORAGE_PREFIX}:dismissed-at`;
const INSTALLED_KEY = `${INSTALL_PROMPT_STORAGE_PREFIX}:installed`;

const MOBILE_MAX_WIDTH_PX = 768;

type UserChoiceResultDetail = { readonly message: string };

const readStorageNumber = (storage: Storage, key: string): number | null => {
	try {
		const raw = storage.getItem(key);
		if (raw === null) {
			return null;
		}
		const value = Number(raw);
		return Number.isFinite(value) ? value : null;
	} catch {
		return null;
	}
};

const readStorageFlag = (storage: Storage, key: string): boolean => {
	try {
		return storage.getItem(key) === 'true';
	} catch {
		return false;
	}
};

const writeStorage = (storage: Storage, key: string, value: string): void => {
	try {
		storage.setItem(key, value);
	} catch {
		// Private browsing, exhausted quota, or storage disabled: never fatal here.
	}
};

const bumpVisitCount = (storage: Storage): number => {
	const next = (readStorageNumber(storage, VISITS_KEY) ?? 0) + 1;
	writeStorage(storage, VISITS_KEY, String(next));
	return next;
};

const isWithinDismissCooldown = (storage: Storage, now: number): boolean => {
	const dismissedAt = readStorageNumber(storage, DISMISSED_AT_KEY);
	return dismissedAt !== null && now - dismissedAt < INSTALL_PROMPT_DISMISS_COOLDOWN_MS;
};

/** Already installed and running as a standalone app (Android/desktop Chrome, or legacy iOS). */
const isStandaloneDisplayMode = (): boolean => {
	try {
		if (window.matchMedia('(display-mode: standalone)').matches) {
			return true;
		}
	} catch {
		// matchMedia unsupported: fall through to the iOS-only check below.
	}
	return (navigator as Navigator & { readonly standalone?: boolean }).standalone === true;
};

/** Coarse pointer (touch) or a narrow viewport: good enough signal without a UA sniff. */
const isMobileViewport = (): boolean => {
	try {
		return (
			window.matchMedia('(pointer: coarse)').matches ||
			window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`).matches
		);
	} catch {
		return false;
	}
};

const createElement = (): PWAInstallElement => {
	const element = document.createElement('pwa-install') as PWAInstallElement;
	// Manual mode on every platform: we call showDialog() ourselves once our
	// own visit/cooldown rules say it's time, instead of the component's
	// own auto-show heuristics.
	element.manualApple = true;
	element.manualChrome = true;
	element.manifestUrl = '/manifest.json';
	return element;
};

const wireEvents = (element: PWAInstallElement, storage: Storage): void => {
	element.addEventListener('pwa-install-success-event', () => {
		writeStorage(storage, INSTALLED_KEY, 'true');
	});
	element.addEventListener('pwa-user-choice-result-event', (event) => {
		const { message } = (event as CustomEvent<UserChoiceResultDetail>).detail;
		if (message === 'accepted') {
			trackInstallPromptAccepted();
		} else if (message === 'dismissed') {
			writeStorage(storage, DISMISSED_AT_KEY, String(Date.now()));
			trackInstallPromptDismissed();
		}
	});
};

/**
 * Set up the install prompt for this session. Safe to call once at boot;
 * it either appends nothing (platform/eligibility checks fail) or appends
 * the `<pwa-install>` element to `document.body` and shows it a few seconds
 * later.
 */
export function initInstallPrompt(storage: Storage = localStorage): void {
	if (isStandaloneDisplayMode() || !isMobileViewport()) {
		return;
	}
	if (readStorageFlag(storage, INSTALLED_KEY)) {
		return;
	}

	const visits = bumpVisitCount(storage);
	if (visits < INSTALL_PROMPT_MIN_VISITS || isWithinDismissCooldown(storage, Date.now())) {
		return;
	}

	const element = createElement();
	wireEvents(element, storage);
	document.body.appendChild(element);

	setTimeout(() => {
		if (!document.body.contains(element)) {
			return;
		}
		trackInstallPromptShown();
		element.showDialog();
	}, INSTALL_PROMPT_SHOW_DELAY_MS);
}
