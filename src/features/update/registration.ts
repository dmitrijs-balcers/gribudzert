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

const isUpdateInstalled = (worker: UpdateWorker, container: UpdateContainer): boolean =>
	worker.state === 'installed' && container.controller !== null;

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
			if (isUpdateInstalled(installing, container)) {
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
