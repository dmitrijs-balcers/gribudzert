/**
 * Global test setup: a DOM with layout for Leaflet, and quiet console output.
 * No application module is mocked here; the real Leaflet runs against the DOM.
 */

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

afterEach(() => {
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
});
