import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';
import { disposeRenderedApp } from './harness';

export const MAP_WIDTH = 600;
export const MAP_HEIGHT = 400;

const isMapContainer = (element: Element): boolean => element.id === 'map';

const mapContainerRect = (): DOMRect =>
	({
		x: 0,
		y: 0,
		top: 0,
		left: 0,
		right: MAP_WIDTH,
		bottom: MAP_HEIGHT,
		width: MAP_WIDTH,
		height: MAP_HEIGHT,
		toJSON: () => ({}),
	}) as DOMRect;

const giveMapContainerARealSizeSoLeafletCanComputeBoundsAndPixelPositions = (): void => {
	const proto = HTMLElement.prototype;
	const originalGetBoundingClientRect = proto.getBoundingClientRect;

	Object.defineProperty(proto, 'clientWidth', {
		configurable: true,
		get(this: HTMLElement) {
			return isMapContainer(this) ? MAP_WIDTH : 0;
		},
	});
	Object.defineProperty(proto, 'clientHeight', {
		configurable: true,
		get(this: HTMLElement) {
			return isMapContainer(this) ? MAP_HEIGHT : 0;
		},
	});
	proto.getBoundingClientRect = function getBoundingClientRect(this: HTMLElement): DOMRect {
		return isMapContainer(this) ? mapContainerRect() : originalGetBoundingClientRect.call(this);
	};
};

giveMapContainerARealSizeSoLeafletCanComputeBoundsAndPixelPositions();

const createMemoryStorage = (): Storage => {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
		setItem: (key: string, value: string) => {
			store.set(key, String(value));
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => {
			store.clear();
		},
		key: (index: number) => Array.from(store.keys())[index] ?? null,
		get length() {
			return store.size;
		},
	} as unknown as Storage;
};

const replaceUnusableNodeLocalStorageGlobalWithAWorkingOne = (): void => {
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: createMemoryStorage(),
	});
};

replaceUnusableNodeLocalStorageGlobalWithAWorkingOne();

const silenceConsoleUnlessDebugging = (): void => {
	if (!process.env.DEBUG) {
		vi.spyOn(console, 'info').mockImplementation(() => undefined);
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	}
};

beforeEach(() => {
	silenceConsoleUnlessDebugging();
});

const INDEXED_DB_DRAIN_TURNS = 20;

const letFireAndForgetFacilityCacheSavesFinishAgainstTheirOwnDatabase = async (): Promise<void> => {
	for (let turn = 0; turn < INDEXED_DB_DRAIN_TURNS; turn += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
};

const blurFocusedElement = (): void => {
	if (document.activeElement instanceof HTMLElement) {
		document.activeElement.blur();
	}
};

const clearScenarioInstalledBrowserFakes = (): void => {
	delete (navigator as { doNotTrack?: string }).doNotTrack;
	delete (window as { umami?: unknown }).umami;
	Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
};

afterEach(async () => {
	disposeRenderedApp();
	vi.useRealTimers();
	vi.restoreAllMocks();
	blurFocusedElement();
	document.body.innerHTML = '';
	clearScenarioInstalledBrowserFakes();
	await letFireAndForgetFacilityCacheSavesFinishAgainstTheirOwnDatabase();
	globalThis.indexedDB = new IDBFactory();
	localStorage.clear();
});
