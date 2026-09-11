import { SERVICE_WORKER_PATH } from '../core/config';
import type { UpdateContainer, UpdateRegistration, VisibilityDocument } from '../features/update';
import {
	activateWaiting,
	checkForUpdateOnVisible,
	hasWaitingWorker,
	onControllerChange,
	watchForUpdate,
} from '../features/update';
import * as logger from '../utils/logger';
import { UPDATE_READY_MESSAGE, UPDATE_RELOAD_ACTION_LABEL } from './messages';
import type { NoticeCenter } from './notices';
import type { AppUpdateRuntime } from './update';
import { createAppUpdateRuntime } from './update';

/**
 * Wires the "new version ready" flow onto a service worker registration: shows a sticky
 * card the first time an update is waiting, activates it on request, and reloads once
 * (and only once) that activation actually takes over the page. Kept separate from
 * `registerServiceWorker` so tests can drive it with fakes.
 */
export const wireAppUpdates = (
	registration: UpdateRegistration,
	container: UpdateContainer,
	doc: VisibilityDocument,
	reload: () => void,
	notices: Pick<NoticeCenter, 'card'>
): AppUpdateRuntime => {
	const runtime = createAppUpdateRuntime({
		showUpdateReady: () =>
			notices.card(UPDATE_READY_MESSAGE, {
				label: UPDATE_RELOAD_ACTION_LABEL,
				onSelect: () => runtime.dispatch({ kind: 'reload-requested' }),
			}),
		activateWaiting: () => activateWaiting(registration),
		reload,
	});

	if (hasWaitingWorker(registration)) {
		runtime.dispatch({ kind: 'update-waiting' });
	}
	watchForUpdate(registration, container, () => runtime.dispatch({ kind: 'update-waiting' }));
	onControllerChange(container, () => runtime.dispatch({ kind: 'controller-changed' }));
	checkForUpdateOnVisible(doc, registration);

	return runtime;
};

export const registerServiceWorker = (notices: Pick<NoticeCenter, 'card'>): void => {
	if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
		return;
	}
	navigator.serviceWorker
		.register(SERVICE_WORKER_PATH)
		.then((registration) => {
			wireAppUpdates(
				registration,
				navigator.serviceWorker,
				document,
				() => location.reload(),
				notices
			);
		})
		.catch((error: unknown) => {
			logger.error('Service worker registration failed', error);
		});
};
