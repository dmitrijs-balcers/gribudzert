/**
 * Integration harness: boots the real application entry against a DOM and fakes only the
 * browser boundaries (Overpass over `fetch`, `navigator.geolocation`). Everything the tests
 * observe or drive goes through the DOM the viewer sees.
 */

import { fireEvent, waitFor } from '@testing-library/dom';
import * as L from 'leaflet';
import { expect, vi } from 'vitest';
import type { OverpassElement } from './fixtures';
import { USER, WATER_ELEMENTS } from './fixtures';
import { MAP_HEIGHT, MAP_WIDTH } from './setup';

// ---------------------------------------------------------------------------
// Overpass fake
// ---------------------------------------------------------------------------

/**
 * Bounding box as written into the Overpass query
 */
export type Bbox = {
	readonly south: number;
	readonly west: number;
	readonly north: number;
	readonly east: number;
};

export const bboxCenter = (bbox: Bbox): { lat: number; lon: number } => ({
	lat: (bbox.south + bbox.north) / 2,
	lon: (bbox.west + bbox.east) / 2,
});

/**
 * Bounds Leaflet would compute for a plain, unpadded viewport centred on `center` at
 * `zoom`, using the same container size the tests give the map (see `MAP_WIDTH`/`MAP_HEIGHT`
 * in tests/setup.ts). Spins up a detached, throwaway map to get the real projection math
 * rather than reimplementing it — used to verify that a fetch's bbox was padded beyond the
 * visible area.
 */
export function unpaddedViewportBbox(center: { readonly lat: number; readonly lon: number }, zoom: number): Bbox {
	const probe = document.createElement('div');
	Object.defineProperty(probe, 'clientWidth', { configurable: true, value: MAP_WIDTH });
	Object.defineProperty(probe, 'clientHeight', { configurable: true, value: MAP_HEIGHT });
	probe.getBoundingClientRect = () =>
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

	const map = L.map(probe, {
		center: [center.lat, center.lon],
		zoom,
		zoomControl: false,
		attributionControl: false,
	});
	const bounds = map.getBounds();
	map.remove();

	const sw = bounds.getSouthWest();
	const ne = bounds.getNorthEast();
	return { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng };
}

/**
 * An HTTP response the fake Overpass answers with instead of a 200
 */
export type OverpassStatusReply = {
	readonly status: number;
	/** Seconds to report in the `Retry-After` header, when given */
	readonly retryAfter?: number;
};

/**
 * What the fake Overpass answers: elements, a non-2xx status, a thrown failure, or nothing
 * until the app gives up
 */
export type OverpassReply = readonly OverpassElement[] | OverpassStatusReply | Error | 'timeout';

export type OverpassRequest = {
	readonly bbox: Bbox;
	readonly query: string;
	/** Whether the app cancelled this request through its AbortSignal */
	readonly aborted: boolean;
};

export type OverpassHandler = (request: OverpassRequest) => OverpassReply | Promise<OverpassReply>;

export type OverpassFake = {
	readonly requests: readonly OverpassRequest[];
	/** Requests that neither replied nor were aborted yet */
	readonly pending: number;
	readonly lastRequest: () => OverpassRequest;
	readonly requestAt: (index: number) => OverpassRequest;
	readonly respondWith: (handler: OverpassHandler) => void;
};

const BBOX_PATTERN = /\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\)/;

const parseBbox = (query: string): Bbox => {
	const match = BBOX_PATTERN.exec(query);
	if (match === null) {
		throw new Error(`Overpass query carries no bounding box:\n${query}`);
	}
	return {
		south: Number(match[1]),
		west: Number(match[2]),
		north: Number(match[3]),
		east: Number(match[4]),
	};
};

const queryOf = (init: RequestInit | undefined): string => {
	const body = typeof init?.body === 'string' ? init.body : '';
	if (!body.startsWith('data=')) {
		throw new Error(`Unexpected Overpass request body: ${body}`);
	}
	return decodeURIComponent(body.slice('data='.length));
};

const abortError = (): Error => new DOMException('The operation was aborted.', 'AbortError');

const jsonResponse = (elements: readonly OverpassElement[]): Response =>
	({
		ok: true,
		status: 200,
		statusText: 'OK',
		headers: { get: () => null },
		json: async () => ({ elements }),
	}) as unknown as Response;

const statusResponse = (reply: OverpassStatusReply): Response =>
	({
		ok: reply.status >= 200 && reply.status < 300,
		status: reply.status,
		statusText: '',
		headers: {
			get: (name: string) =>
				reply.retryAfter !== undefined && name.toLowerCase() === 'retry-after'
					? String(reply.retryAfter)
					: null,
		},
		json: async () => ({ elements: [] }),
	}) as unknown as Response;

/**
 * Install a fake Overpass API on `globalThis.fetch`
 */
export function fakeOverpass(initial: OverpassHandler): OverpassFake {
	let handler = initial;
	const requests: OverpassRequest[] = [];
	let pending = 0;

	const fetchFake = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
		if (!url.includes('overpass')) {
			return Promise.reject(new Error(`Unexpected fetch to ${url}`));
		}
		const signal = init?.signal ?? null;
		const query = queryOf(init);
		const request: OverpassRequest = {
			bbox: parseBbox(query),
			query,
			get aborted() {
				return signal?.aborted === true;
			},
		};
		requests.push(request);
		pending += 1;

		return new Promise<Response>((resolve, reject) => {
			let settled = false;
			const finish = (): void => {
				if (!settled) {
					settled = true;
					pending -= 1;
				}
			};
			const onAbort = (): void => {
				finish();
				reject(abortError());
			};
			if (signal?.aborted) {
				onAbort();
				return;
			}
			signal?.addEventListener('abort', onAbort, { once: true });

			Promise.resolve(handler(request)).then(
				(reply) => {
					if (settled || reply === 'timeout') {
						return;
					}
					signal?.removeEventListener('abort', onAbort);
					finish();
					if (reply instanceof Error) {
						reject(reply);
					} else if ('status' in reply) {
						resolve(statusResponse(reply));
					} else {
						resolve(jsonResponse(reply));
					}
				},
				(error: unknown) => {
					if (!settled) {
						signal?.removeEventListener('abort', onAbort);
						finish();
						reject(error);
					}
				}
			);
		});
	};

	globalThis.fetch = fetchFake as typeof fetch;

	const requestAt = (index: number): OverpassRequest => {
		const request = requests.at(index);
		if (request === undefined) {
			throw new Error(`No Overpass request #${index} (${requests.length} made)`);
		}
		return request;
	};

	return {
		requests,
		get pending() {
			return pending;
		},
		lastRequest: () => requestAt(-1),
		requestAt,
		respondWith: (next) => {
			handler = next;
		},
	};
}

/**
 * A promise settled by the test, for replies that must arrive at a chosen moment
 */
export type Deferred<T> = {
	readonly promise: Promise<T>;
	readonly resolve: (value: T) => void;
	readonly reject: (error: Error) => void;
};

export function deferred<T>(): Deferred<T> {
	let resolve: (value: T) => void = () => undefined;
	let reject: (error: Error) => void = () => undefined;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// Geolocation fake
// ---------------------------------------------------------------------------

export const GEO_PERMISSION_DENIED = 1;
export const GEO_POSITION_UNAVAILABLE = 2;
export const GEO_TIMEOUT = 3;

export type GeoOutcome =
	| {
			readonly position: { readonly lat: number; readonly lon: number; readonly accuracy?: number };
	  }
	| { readonly error: number };

export type GeolocationFake = {
	/** Change what the next position requests answer */
	readonly respondWith: (outcome: GeoOutcome) => void;
	readonly requests: number;
};

const toPosition = (outcome: {
	readonly lat: number;
	readonly lon: number;
	readonly accuracy?: number;
}): GeolocationPosition =>
	({
		coords: {
			latitude: outcome.lat,
			longitude: outcome.lon,
			accuracy: outcome.accuracy ?? 10,
			altitude: null,
			altitudeAccuracy: null,
			heading: null,
			speed: null,
		},
		timestamp: Date.now(),
	}) as GeolocationPosition;

const toPositionError = (code: number): GeolocationPositionError =>
	({
		code,
		message: `Geolocation error ${code}`,
		PERMISSION_DENIED: GEO_PERMISSION_DENIED,
		POSITION_UNAVAILABLE: GEO_POSITION_UNAVAILABLE,
		TIMEOUT: GEO_TIMEOUT,
	}) as GeolocationPositionError;

/**
 * Install a fake Geolocation API on `navigator.geolocation`
 */
export function fakeGeolocation(initial: GeoOutcome): GeolocationFake {
	let outcome = initial;
	let requests = 0;

	const geolocation: Geolocation = {
		getCurrentPosition: (success, failure) => {
			requests += 1;
			const current = outcome;
			void Promise.resolve().then(() => {
				if ('position' in current) {
					success(toPosition(current.position));
				} else {
					failure?.(toPositionError(current.error));
				}
			});
		},
		watchPosition: () => 0,
		clearWatch: () => undefined,
	};
	Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation });

	return {
		respondWith: (next) => {
			outcome = next;
		},
		get requests() {
			return requests;
		},
	};
}

// ---------------------------------------------------------------------------
// Rendering the app
// ---------------------------------------------------------------------------

/**
 * Stroke colour of the accuracy circle drawn around the viewer's position
 */
const USER_CIRCLE_STROKE = '#136AEC';

export type PanDirection = 'left' | 'up' | 'right' | 'down';

const PAN_KEY_CODES: Readonly<Record<PanDirection, number>> = {
	left: 37,
	up: 38,
	right: 39,
	down: 40,
};

export type AppHandle = {
	readonly container: HTMLElement;
	readonly overpass: OverpassFake;
	readonly geolocation: GeolocationFake;
	/** Facility markers on the map (the viewer's own position marker is not one) */
	readonly markers: () => readonly Element[];
	/** The viewer's position marker and accuracy circle, as currently drawn */
	readonly userLocation: () => { markers: number; circles: number };
	/** Messages of the toasts currently on screen */
	readonly toasts: () => readonly string[];
	/** Every toast message shown since the app started, in order */
	readonly toastHistory: () => readonly string[];
	readonly loadingVisible: () => boolean;
	/** Wait until every Overpass request the app started has been answered */
	readonly settled: () => Promise<void>;
	readonly layerCheckbox: (label: string) => HTMLInputElement;
	readonly toggleLayer: (label: string) => void;
	readonly clickLocate: () => void;
	readonly zoomIn: () => void;
	readonly zoomOut: () => void;
	/** Pan with the keyboard; `far` (shift + arrow) moves a third of the viewport */
	readonly pan: (direction: PanDirection, options?: { readonly far?: boolean }) => void;
	readonly openPopupOf: (index: number) => void;
	readonly popup: () => HTMLElement | null;
	readonly popupText: () => string;
};

export type RenderOptions = {
	readonly geolocation?: GeoOutcome;
	readonly overpass?: OverpassHandler;
	/** Wait for the first Overpass reply before returning (default: true) */
	readonly settle?: boolean;
};

const clickOn = (element: Element | null, what: string): void => {
	if (element === null) {
		throw new Error(`${what} is not on the page`);
	}
	fireEvent.click(element);
};

const flushMicrotasks = async (): Promise<void> => {
	for (let i = 0; i < 10; i += 1) {
		await Promise.resolve();
	}
};

/**
 * Boot the application into a fresh `#map` container with faked browser boundaries
 */
export async function renderApp(options: RenderOptions = {}): Promise<AppHandle> {
	if (document.activeElement instanceof HTMLElement) {
		document.activeElement.blur();
	}
	document.body.innerHTML = '';
	const container = document.createElement('div');
	container.id = 'map';
	document.body.appendChild(container);

	const toastHistory: string[] = [];
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of Array.from(mutation.addedNodes)) {
				if (node instanceof HTMLElement && node.classList.contains('notification')) {
					toastHistory.push(node.querySelector('.notification-message')?.textContent?.trim() ?? '');
				}
			}
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });

	const overpass = fakeOverpass(options.overpass ?? (() => WATER_ELEMENTS));
	const geolocation = fakeGeolocation(options.geolocation ?? { position: USER });

	vi.resetModules();
	await import('../src/index');

	await waitFor(() => expect(container.classList.contains('leaflet-container')).toBe(true));
	await waitFor(() => expect(overpass.requests.length).toBeGreaterThan(0));
	const settled = async (): Promise<void> => {
		await waitFor(() => expect(overpass.pending).toBe(0));
		await flushMicrotasks();
	};
	if (options.settle !== false) {
		await settled();
	}

	const markers = (): readonly Element[] => [
		...Array.from(
			container.querySelectorAll(
				`.leaflet-overlay-pane path.leaflet-interactive:not([stroke="${USER_CIRCLE_STROKE}"])`
			)
		),
		...Array.from(container.querySelectorAll('.leaflet-marker-pane div.leaflet-marker-icon')),
	];

	const popup = (): HTMLElement | null =>
		container.querySelector<HTMLElement>('.leaflet-popup-pane .leaflet-popup-content');

	const layerCheckbox = (label: string): HTMLInputElement => {
		const labels = Array.from(container.querySelectorAll('.leaflet-control-layers-overlays label'));
		const match = labels.find((element) => element.textContent?.trim() === label);
		const input = match?.querySelector('input');
		if (!(input instanceof HTMLInputElement)) {
			throw new Error(`No "${label}" layer in the layer control`);
		}
		return input;
	};

	return {
		container,
		overpass,
		geolocation,
		markers,
		userLocation: () => ({
			markers: container.querySelectorAll('.leaflet-marker-pane img.leaflet-marker-icon').length,
			circles: container.querySelectorAll(
				`.leaflet-overlay-pane path[stroke="${USER_CIRCLE_STROKE}"]`
			).length,
		}),
		toasts: () =>
			Array.from(
				document.querySelectorAll('.notification:not(.notification-exit) .notification-message')
			).map((element) => element.textContent?.trim() ?? ''),
		toastHistory: () => toastHistory,
		loadingVisible: () => document.querySelector('.loading-overlay.loading-visible') !== null,
		settled,
		layerCheckbox,
		toggleLayer: (label) => clickOn(layerCheckbox(label), `"${label}" checkbox`),
		clickLocate: () =>
			clickOn(container.querySelector('a[aria-label="Show my location"]'), 'Locate button'),
		zoomIn: () => clickOn(container.querySelector('.leaflet-control-zoom-in'), 'Zoom in button'),
		zoomOut: () => clickOn(container.querySelector('.leaflet-control-zoom-out'), 'Zoom out button'),
		pan: (direction, panOptions = {}) => {
			container.focus();
			const event = new KeyboardEvent('keydown', {
				bubbles: true,
				shiftKey: panOptions.far ?? true,
			});
			Object.defineProperty(event, 'keyCode', { value: PAN_KEY_CODES[direction] });
			document.dispatchEvent(event);
		},
		openPopupOf: (index) => clickOn(markers()[index] ?? null, `Marker #${index}`),
		popup,
		popupText: () => popup()?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
	};
}
