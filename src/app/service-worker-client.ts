import { SERVICE_WORKER_PATH } from '../core/config';
import {
	activateWaiting,
	checkForUpdateOnVisible,
	hasWaitingWorker,
	onControllerChange,
	watchForUpdate,
} from '../features/update';
import type { UpdateContainer, UpdateRegistration, VisibilityDocument } from '../features/update';
import { showNotification } from '../ui/notifications';
import * as logger from '../utils/logger';
import { UPDATE_READY_MESSAGE, UPDATE_RELOAD_ACTION_LABEL } from './messages';
import { createAppUpdateRuntime } from './update';
import type { AppUpdateRuntime } from './update';

/**
 * Wires the "new version ready" flow onto a service worker registration: shows a sticky
 * toast the first time an update is waiting, activates it on request, and reloads once
 * (and only once) that activation actually takes over the page. Kept separate from
 * `registerServiceWorker` so tests can drive it with fakes.
 */
export const wireAppUpdates = (
	registration: UpdateRegistration,
	container: UpdateContainer,
	doc: VisibilityDocument,
	reload: () => void
): AppUpdateRuntime => {
	const runtime = createAppUpdateRuntime({
		showUpdateReady: () =>
			showNotification(UPDATE_READY_MESSAGE, 'info', 0, {
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

export const registerServiceWorker = (): void => {
	if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
		return;
	}
	navigator.serviceWorker
		.register(SERVICE_WORKER_PATH)
		.then((registration) => {
			wireAppUpdates(registration, navigator.serviceWorker, document, () => location.reload());
		})
		.catch((error: unknown) => {
			logger.error('Service worker registration failed', error);
		});
};
