import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InstalledNoticeCenter } from '../../src/app/notices';
import { installNoticeCenter } from '../../src/app/notices';
import { timestampNow } from '../../src/domain';
import type {
	UpdateContainer,
	UpdateRegistration,
	UpdateWorker,
	UpdateWorkerState,
	VisibilityDocument,
} from '../../src/features/update';

type FakeWorker = UpdateWorker & {
	readonly setState: (state: UpdateWorkerState) => void;
	readonly messages: readonly unknown[];
};

const fakeWorker = (initialState: UpdateWorkerState): FakeWorker => {
	let state = initialState;
	const stateListeners: Array<() => void> = [];
	const messages: unknown[] = [];
	return {
		get state() {
			return state;
		},
		addEventListener: (type, listener) => {
			if (type === 'statechange') {
				stateListeners.push(listener);
			}
		},
		postMessage: (message) => {
			messages.push(message);
		},
		setState: (next) => {
			state = next;
			for (const listener of stateListeners) {
				listener();
			}
		},
		messages,
	};
};

type FakeRegistration = UpdateRegistration & {
	readonly triggerUpdateFound: (worker: FakeWorker) => void;
	readonly updateCallCount: () => number;
};

const fakeRegistration = (initialWaiting: FakeWorker | null): FakeRegistration => {
	let installing: FakeWorker | null = null;
	const updateFoundListeners: Array<() => void> = [];
	let updateCalls = 0;
	return {
		waiting: initialWaiting,
		get installing() {
			return installing;
		},
		addEventListener: (type, listener) => {
			if (type === 'updatefound') {
				updateFoundListeners.push(listener);
			}
		},
		update: async () => {
			updateCalls += 1;
		},
		triggerUpdateFound: (worker) => {
			installing = worker;
			for (const listener of updateFoundListeners) {
				listener();
			}
		},
		updateCallCount: () => updateCalls,
	};
};

type FakeContainer = UpdateContainer & {
	readonly setController: (controller: unknown) => void;
	readonly fireControllerChange: () => void;
};

const fakeContainer = (initialController: unknown): FakeContainer => {
	let controller = initialController;
	const listeners: Array<() => void> = [];
	return {
		get controller() {
			return controller;
		},
		addEventListener: (type, listener) => {
			if (type === 'controllerchange') {
				listeners.push(listener);
			}
		},
		setController: (next) => {
			controller = next;
		},
		fireControllerChange: () => {
			for (const listener of listeners) {
				listener();
			}
		},
	};
};

type FakeDocument = VisibilityDocument & {
	readonly setVisibility: (state: 'visible' | 'hidden') => void;
};

const fakeDocument = (initial: 'visible' | 'hidden'): FakeDocument => {
	let visibilityState = initial;
	const listeners: Array<() => void> = [];
	return {
		get visibilityState() {
			return visibilityState;
		},
		addEventListener: (type, listener) => {
			if (type === 'visibilitychange') {
				listeners.push(listener);
			}
		},
		setVisibility: (next) => {
			visibilityState = next;
			for (const listener of listeners) {
				listener();
			}
		},
	};
};

const importServiceWorkerClient = async () => {
	vi.resetModules();
	return import('../../src/app/service-worker-client');
};

const UPDATE_READY_MESSAGE = 'A new version is ready.';

const toastMessages = (): readonly string[] =>
	Array.from(document.querySelectorAll('.notice-message')).map(
		(element) => element.textContent?.trim() ?? ''
	);

const reloadButton = (): HTMLButtonElement | null =>
	document.querySelector<HTMLButtonElement>('.notice-action');

describe('Getting the latest version via a sticky update toast', () => {
	let notices: InstalledNoticeCenter;

	beforeEach(() => {
		notices = installNoticeCenter(document.body, timestampNow);
	});

	afterEach(() => {
		notices.destroy();
	});

	it('shows a sticky "new version ready" toast when a worker is already waiting', async () => {
		const { wireAppUpdates } = await importServiceWorkerClient();
		const registration = fakeRegistration(fakeWorker('installed'));
		const container = fakeContainer('current-controller');

		wireAppUpdates(registration, container, fakeDocument('visible'), vi.fn(), notices.center);

		expect(toastMessages()).toEqual([UPDATE_READY_MESSAGE]);
		expect(reloadButton()).not.toBeNull();
	});

	it('shows the toast once an update finishes installing later', async () => {
		const { wireAppUpdates } = await importServiceWorkerClient();
		const registration = fakeRegistration(null);
		const container = fakeContainer('current-controller');

		wireAppUpdates(registration, container, fakeDocument('visible'), vi.fn(), notices.center);
		expect(toastMessages()).toEqual([]);

		const installing = fakeWorker('installing');
		registration.triggerUpdateFound(installing);
		installing.setState('installed');

		expect(toastMessages()).toEqual([UPDATE_READY_MESSAGE]);
	});

	it('never shows the toast twice for the same page load', async () => {
		const { wireAppUpdates } = await importServiceWorkerClient();
		const registration = fakeRegistration(fakeWorker('installed'));
		const container = fakeContainer('current-controller');

		wireAppUpdates(registration, container, fakeDocument('visible'), vi.fn(), notices.center);

		const installing = fakeWorker('installing');
		registration.triggerUpdateFound(installing);
		installing.setState('installed');

		expect(toastMessages()).toHaveLength(1);
	});

	it('does not reload on the very first install, when the page has nothing waiting for it', async () => {
		const { wireAppUpdates } = await importServiceWorkerClient();
		const registration = fakeRegistration(null);
		const container = fakeContainer(null);
		const reload = vi.fn();

		wireAppUpdates(registration, container, fakeDocument('visible'), reload, notices.center);

		container.setController('first-controller');
		container.fireControllerChange();

		expect(reload).not.toHaveBeenCalled();
		expect(toastMessages()).toEqual([]);
	});

	it('activates the waiting worker and reloads only after the user presses Reload', async () => {
		const { wireAppUpdates } = await importServiceWorkerClient();
		const waitingWorker = fakeWorker('installed');
		const registration = fakeRegistration(waitingWorker);
		const container = fakeContainer('current-controller');
		const reload = vi.fn();

		wireAppUpdates(registration, container, fakeDocument('visible'), reload, notices.center);

		const button = reloadButton();
		if (button === null) {
			throw new Error('Reload action was not rendered on the update-ready toast');
		}
		button.click();

		expect(waitingWorker.messages).toEqual([{ type: 'SKIP_WAITING' }]);
		expect(reload).not.toHaveBeenCalled();

		container.setController('new-controller');
		container.fireControllerChange();

		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('checks for an update once the tab becomes visible again', async () => {
		const { wireAppUpdates } = await importServiceWorkerClient();
		const registration = fakeRegistration(null);
		const container = fakeContainer('current-controller');
		const doc = fakeDocument('hidden');

		wireAppUpdates(registration, container, doc, vi.fn(), notices.center);
		expect(registration.updateCallCount()).toBe(0);

		doc.setVisibility('visible');
		expect(registration.updateCallCount()).toBe(1);

		doc.setVisibility('hidden');
		expect(registration.updateCallCount()).toBe(1);
	});
});
