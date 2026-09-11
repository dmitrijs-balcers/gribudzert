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
} from '../core/config';
import type { InstallHistory, InvitationPolicy } from '../domain';
import {
	invitationVerdict,
	recordDismissal,
	recordInstall,
	recordVisit,
	timestampNow,
} from '../domain';
import {
	isMobileViewport,
	isRunningStandalone,
	loadInstallHistory,
	saveInstallHistory,
} from '../features/install';

const policy: InvitationPolicy = {
	minVisits: INSTALL_PROMPT_MIN_VISITS,
	dismissCooldownMs: INSTALL_PROMPT_DISMISS_COOLDOWN_MS,
};

type UserChoiceResultDetail = { readonly message: string };

const createElement = (): PWAInstallElement => {
	const element = document.createElement('pwa-install') as PWAInstallElement;
	element.manualApple = true;
	element.manualChrome = true;
	element.manifestUrl = '/manifest.json';
	return element;
};

const wireEvents = (
	element: PWAInstallElement,
	history: InstallHistory,
	storage: Pick<Storage, 'setItem'>
): void => {
	element.addEventListener('pwa-install-success-event', () => {
		saveInstallHistory(storage, recordInstall(history));
	});
	element.addEventListener('pwa-user-choice-result-event', (event) => {
		const { message } = (event as CustomEvent<UserChoiceResultDetail>).detail;
		if (message === 'accepted') {
			trackInstallPromptAccepted();
		} else if (message === 'dismissed') {
			saveInstallHistory(storage, recordDismissal(history, timestampNow()));
			trackInstallPromptDismissed();
		}
	});
};

const isStillMountedAndInstallable = (element: PWAInstallElement): boolean =>
	document.body.contains(element) && element.isInstallAvailable;

const showWhenInstallable = (element: PWAInstallElement): void => {
	setTimeout(() => {
		if (!isStillMountedAndInstallable(element)) {
			return;
		}
		trackInstallPromptShown();
		element.showDialog();
	}, INSTALL_PROMPT_SHOW_DELAY_MS);
};

export const initInstallPrompt = (storage: Pick<Storage, 'getItem' | 'setItem'>): void => {
	if (isRunningStandalone() || !isMobileViewport()) {
		return;
	}
	const history = recordVisit(loadInstallHistory(storage));
	saveInstallHistory(storage, history);
	if (invitationVerdict(history, policy, timestampNow()) !== 'invite') {
		return;
	}
	const element = createElement();
	wireEvents(element, history, storage);
	document.body.appendChild(element);
	showWhenInstallable(element);
};
