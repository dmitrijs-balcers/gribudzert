/**
 * Adapters over `ServiceWorkerRegistration` / `navigator.serviceWorker`.
 *
 * Every function takes the browser objects it needs as parameters (rather than reaching
 * for `navigator` itself), so tests can pass fakes with the same shape without touching
 * a real service worker. Types here are deliberately narrower than the DOM lib's own —
 * a real registration, container, or document satisfies them structurally.
 */

export type UpdateWorkerState =
	| 'parsed'
	| 'installing'
	| 'installed'
	| 'activating'
	| 'activated'
	| 'redundant';

export type UpdateWorker = {
	readonly state: UpdateWorkerState;
	readonly addEventListener: (type: 'statechange', listener: () => void) => void;
	readonly postMessage: (message: unknown) => void;
};

export type UpdateRegistration = {
	readonly waiting: UpdateWorker | null;
	readonly installing: UpdateWorker | null;
	readonly addEventListener: (type: 'updatefound', listener: () => void) => void;
	readonly update: () => Promise<unknown>;
};

export type UpdateContainer = {
	readonly controller: unknown;
	readonly addEventListener: (type: 'controllerchange', listener: () => void) => void;
};

export type VisibilityDocument = {
	readonly visibilityState: 'visible' | 'hidden';
	readonly addEventListener: (type: 'visibilitychange', listener: () => void) => void;
};

const SKIP_WAITING_MESSAGE = { type: 'SKIP_WAITING' } as const;

export const hasWaitingWorker = (registration: UpdateRegistration): boolean =>
	registration.waiting !== null;

/**
 * Watches a registration for a newly installed worker that is ready to take over. A
 * worker only reaches `installed` while there is already a `controller` when it is an
 * update — the very first install has no controller yet, so it is not reported here.
 */
export const watchForUpdate = (
	registration: UpdateRegistration,
	container: UpdateContainer,
	onWaiting: () => void
): void => {
	registration.addEventListener('updatefound', () => {
		const installing = registration.installing;
		if (installing === null) {
			return;
		}
		installing.addEventListener('statechange', () => {
			if (installing.state === 'installed' && container.controller !== null) {
				onWaiting();
			}
		});
	});
};

export const activateWaiting = (registration: UpdateRegistration): void => {
	registration.waiting?.postMessage(SKIP_WAITING_MESSAGE);
};

export const onControllerChange = (container: UpdateContainer, onChange: () => void): void => {
	container.addEventListener('controllerchange', onChange);
};

/** Mirrors how native apps check for updates on foreground: re-check when the tab is shown. */
export const checkForUpdateOnVisible = (
	doc: VisibilityDocument,
	registration: UpdateRegistration
): void => {
	doc.addEventListener('visibilitychange', () => {
		if (doc.visibilityState === 'visible') {
			void registration.update();
		}
	});
};
