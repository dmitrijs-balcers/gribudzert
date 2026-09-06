/**
 * Global test setup: a DOM with layout for Leaflet, and quiet console output.
 * No application module is mocked here; the real Leaflet runs against the DOM.
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Size the map container gets in tests (the DOM has no layout engine)
 */
export const MAP_WIDTH = 600;
export const MAP_HEIGHT = 400;

const isMapContainer = (element: Element): boolean => element.id === 'map';

/**
 * Give the map container a real size so Leaflet can compute bounds and pixel positions
 */
const installLayoutStubs = (): void => {
	const proto = HTMLElement.prototype;
	const originalRect = proto.getBoundingClientRect;

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
		if (!isMapContainer(this)) {
			return originalRect.call(this);
		}
		return {
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			right: MAP_WIDTH,
			bottom: MAP_HEIGHT,
			width: MAP_WIDTH,
			height: MAP_HEIGHT,
			toJSON: () => ({}),
		} as DOMRect;
	};
};

installLayoutStubs();

beforeEach(() => {
	// The app narrates what it does through the logger; keep test output to the results.
	// Run with DEBUG=1 to see it. Spies are restored after every test, hence beforeEach.
	if (!process.env.DEBUG) {
		vi.spyOn(console, 'info').mockImplementation(() => undefined);
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	}
});

/**
 * Number of real-timer turns to wait for before swapping out `indexedDB`. The facility cache
 * persists fire-and-forget (nothing in a test awaits it), and fake-indexeddb schedules its
 * work with real timers rather than resolving synchronously - so a save the just-finished test
 * triggered (e.g. from toggling a layer) can still be mid-flight here. Swapping `indexedDB`
 * out from under it would make its `indexedDB.open(...)` call - evaluated only once that save
 * actually runs - resolve against the *next* test's fresh, empty factory instead of this one,
 * leaking this test's data into it. Draining a handful of turns first lets any such save
 * finish (and land in the database it belongs to) before the swap.
 */
const INDEXED_DB_DRAIN_TURNS = 20;

const drainRealTimerQueue = async (): Promise<void> => {
	for (let turn = 0; turn < INDEXED_DB_DRAIN_TURNS; turn += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
};

afterEach(async () => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	// Leave the map the way a visitor would, so it lets go of its document-level key handlers
	if (document.activeElement instanceof HTMLElement) {
		document.activeElement.blur();
	}
	document.body.innerHTML = '';
	// Browser fakes a scenario may have installed
	delete (navigator as { doNotTrack?: string }).doNotTrack;
	delete (window as { umami?: unknown }).umami;
	// Let any fire-and-forget facility cache save this test triggered land against *its own*
	// indexedDB before replacing it - see `drainRealTimerQueue`.
	await drainRealTimerQueue();
	// Fresh storage for the next test. A test that wants a "reload" with storage kept does so
	// within itself (see `renderApp({ reload: true })`), before this runs.
	globalThis.indexedDB = new IDBFactory();
});
