import { fireEvent, waitFor } from '@testing-library/dom';
import * as L from 'leaflet';
import { expect, vi } from 'vitest';
import { FACILITY_CACHE_DB_NAME, LAST_POSITION_STORAGE_KEY } from '../src/core/config';
import type { OverpassElement } from './fixtures';
import { USER, WATER_ELEMENTS } from './fixtures';
import { MAP_HEIGHT, MAP_WIDTH } from './setup';

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

const createDetachedProbeContainer = (): HTMLDivElement => {
	const container = document.createElement('div');
	Object.defineProperty(container, 'clientWidth', { configurable: true, value: MAP_WIDTH });
	Object.defineProperty(container, 'clientHeight', { configurable: true, value: MAP_HEIGHT });
	container.getBoundingClientRect = () =>
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
	return container;
};

export function unpaddedViewportBbox(
	center: { readonly lat: number; readonly lon: number },
	zoom: number
): Bbox {
	const throwawayMap = L.map(createDetachedProbeContainer(), {
		center: [center.lat, center.lon],
		zoom,
		zoomControl: false,
		attributionControl: false,
	});
	const bounds = throwawayMap.getBounds();
	throwawayMap.remove();

	const southWest = bounds.getSouthWest();
	const northEast = bounds.getNorthEast();
	return { south: southWest.lat, west: southWest.lng, north: northEast.lat, east: northEast.lng };
}

export type OverpassStatusReply = {
	readonly status: number;
	readonly retryAfterSeconds?: number;
};

export type OverpassReply = readonly OverpassElement[] | OverpassStatusReply | Error | 'timeout';

export type OverpassRequest = {
	readonly bbox: Bbox;
	readonly query: string;
	readonly aborted: boolean;
};

export type OverpassHandler = (request: OverpassRequest) => OverpassReply | Promise<OverpassReply>;

export type OverpassFake = {
	readonly requests: readonly OverpassRequest[];
	readonly pendingRequestCount: number;
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
				reply.retryAfterSeconds !== undefined && name.toLowerCase() === 'retry-after'
					? String(reply.retryAfterSeconds)
					: null,
		},
		json: async () => ({ elements: [] }),
	}) as unknown as Response;

export function fakeOverpass(initial: OverpassHandler): OverpassFake {
	let handler = initial;
	const requests: OverpassRequest[] = [];
	let pendingRequestCount = 0;

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
		pendingRequestCount += 1;

		return new Promise<Response>((resolve, reject) => {
			let settled = false;
			const finish = (): void => {
				if (!settled) {
					settled = true;
					pendingRequestCount -= 1;
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
		get pendingRequestCount() {
			return pendingRequestCount;
		},
		lastRequest: () => requestAt(-1),
		requestAt,
		respondWith: (next) => {
			handler = next;
		},
	};
}

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

export const GEO_PERMISSION_DENIED = 1;
export const GEO_POSITION_UNAVAILABLE = 2;
export const GEO_TIMEOUT = 3;

export type GeoPosition = {
	readonly lat: number;
	readonly lon: number;
	readonly accuracy?: number;
	readonly heading?: number;
	readonly speed?: number;
};

export type GeoOutcome =
	| { readonly position: GeoPosition }
	| { readonly error: number }
	| { readonly pending: true };

export type GeolocationFake = {
	readonly respondWith: (outcome: GeoOutcome) => void;
	readonly moveTo: (position: GeoPosition) => void;
	readonly requests: number;
	readonly watchers: number;
};

const DEFAULT_POSITION_ACCURACY = 10;

const toPosition = (outcome: GeoPosition, timestampMs: number): GeolocationPosition =>
	({
		coords: {
			latitude: outcome.lat,
			longitude: outcome.lon,
			accuracy: outcome.accuracy ?? DEFAULT_POSITION_ACCURACY,
			altitude: null,
			altitudeAccuracy: null,
			heading: outcome.heading ?? null,
			speed: outcome.speed ?? null,
		},
		timestamp: timestampMs,
	}) as GeolocationPosition;

const toPositionError = (code: number): GeolocationPositionError =>
	({
		code,
		message: `Geolocation error ${code}`,
		PERMISSION_DENIED: GEO_PERMISSION_DENIED,
		POSITION_UNAVAILABLE: GEO_POSITION_UNAVAILABLE,
		TIMEOUT: GEO_TIMEOUT,
	}) as GeolocationPositionError;

export function fakeGeolocation(initial: GeoOutcome): GeolocationFake {
	let outcome = initial;
	let requests = 0;
	let watchers = 0;
	let lastTimestampMs = 0;
	let nextWatchId = 1;
	const watchCallbacks = new Map<
		number,
		{ readonly success: PositionCallback; readonly failure: PositionErrorCallback | null }
	>();

	const nextTimestampMs = (): number => {
		const now = Date.now();
		lastTimestampMs = now > lastTimestampMs ? now : lastTimestampMs + 1;
		return lastTimestampMs;
	};

	const deliver = (
		success: PositionCallback,
		failure: PositionErrorCallback | null,
		current: GeoOutcome
	): void => {
		if ('pending' in current) {
			return;
		}
		const timestampMs = nextTimestampMs();
		void Promise.resolve().then(() => {
			if ('position' in current) {
				success(toPosition(current.position, timestampMs));
			} else {
				failure?.(toPositionError(current.error));
			}
		});
	};

	const geolocation: Geolocation = {
		getCurrentPosition: (success, failure) => {
			requests += 1;
			deliver(success, failure ?? null, outcome);
		},
		watchPosition: (success, failure) => {
			const id = nextWatchId;
			nextWatchId += 1;
			watchers += 1;
			watchCallbacks.set(id, { success, failure: failure ?? null });
			deliver(success, failure ?? null, outcome);
			return id;
		},
		clearWatch: (id) => {
			if (watchCallbacks.delete(id)) {
				watchers -= 1;
			}
		},
	};
	Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation });

	const respondWith = (next: GeoOutcome): void => {
		outcome = next;
		for (const { success, failure } of watchCallbacks.values()) {
			deliver(success, failure, next);
		}
	};

	return {
		respondWith,
		moveTo: (position) => respondWith({ position }),
		get requests() {
			return requests;
		},
		get watchers() {
			return watchers;
		},
	};
}

export type Permission = 'granted' | 'denied' | 'prompt';

export const installPermissionsFake = (state: Permission): void => {
	const permissions = { query: async () => ({ state }) as PermissionStatus } as Permissions;
	Object.defineProperty(navigator, 'permissions', { configurable: true, value: permissions });
};

export const seedRememberedPosition = (
	position: GeoPosition & { readonly ageMs?: number }
): void => {
	const record = {
		lat: position.lat,
		lon: position.lon,
		accuracy: position.accuracy ?? DEFAULT_POSITION_ACCURACY,
		heading: position.heading ?? null,
		speed: position.speed ?? null,
		at: Date.now() - (position.ageMs ?? 0),
	};
	localStorage.setItem(LAST_POSITION_STORAGE_KEY, JSON.stringify(record));
};

const CACHE_OBJECT_STORE = 'cache';
const CACHE_RECORD_KEY = 'snapshot';

const openCacheDatabaseMirroringAppSchema = (): Promise<IDBDatabase> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.open(FACILITY_CACHE_DB_NAME, 1);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(CACHE_OBJECT_STORE)) {
				db.createObjectStore(CACHE_OBJECT_STORE);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error('Failed to open facility cache database'));
	});

const readCacheRecord = async (): Promise<unknown> => {
	const db = await openCacheDatabaseMirroringAppSchema();
	try {
		return await new Promise<unknown>((resolve, reject) => {
			const request = db
				.transaction(CACHE_OBJECT_STORE, 'readonly')
				.objectStore(CACHE_OBJECT_STORE)
				.get(CACHE_RECORD_KEY);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () =>
				reject(request.error ?? new Error('Failed to read facility cache record'));
		});
	} finally {
		db.close();
	}
};

export async function seedSnapshot(value: unknown): Promise<void> {
	const db = await openCacheDatabaseMirroringAppSchema();
	try {
		await new Promise<void>((resolve, reject) => {
			const transaction = db.transaction(CACHE_OBJECT_STORE, 'readwrite');
			transaction.objectStore(CACHE_OBJECT_STORE).put(value, CACHE_RECORD_KEY);
			transaction.oncomplete = () => resolve();
			transaction.onerror = () =>
				reject(transaction.error ?? new Error('Failed to seed facility cache record'));
			transaction.onabort = () =>
				reject(transaction.error ?? new Error('Facility cache seed was aborted'));
		});
	} finally {
		db.close();
	}
}

const USER_ACCURACY_CIRCLE_STROKE_COLOR = '#136AEC';

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
	readonly markers: () => readonly Element[];
	readonly userLocation: () => { markers: number; circles: number };
	readonly toasts: () => readonly string[];
	readonly toastHistory: () => readonly string[];
	readonly loadingVisible: () => boolean;
	readonly settled: () => Promise<void>;
	readonly layerCheckbox: (label: string) => HTMLInputElement;
	readonly toggleLayer: (label: string) => void;
	readonly locateButton: () => HTMLButtonElement;
	readonly clickLocate: () => void;
	readonly zoomIn: () => void;
	readonly zoomOut: () => void;
	readonly pan: (direction: PanDirection, options?: { readonly far?: boolean }) => void;
	readonly pressArrowKey: (direction: PanDirection) => void;
	readonly openPopupOf: (index: number) => void;
	readonly closePopup: () => void;
	readonly popup: () => HTMLElement | null;
	readonly popupText: () => string;
	readonly hud: () => string | null;
	readonly clickHud: () => void;
	readonly beelineVisible: () => boolean;
	readonly snapshot: () => Promise<unknown>;
};

export type RenderOptions = {
	readonly geolocation?: GeoOutcome;
	readonly overpass?: OverpassHandler;
	readonly settle?: boolean;
	readonly reload?: boolean;
	readonly permission?: Permission;
	readonly rememberedPosition?: GeoPosition & { readonly ageMs?: number };
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

const blurFocusedElement = (): void => {
	if (document.activeElement instanceof HTMLElement) {
		document.activeElement.blur();
	}
};

const NOTIFICATION_CLASS = 'notification';
const NOTIFICATION_MESSAGE_SELECTOR = '.notification-message';

const observeToastHistory = (): readonly string[] => {
	const history: string[] = [];
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of Array.from(mutation.addedNodes)) {
				if (node instanceof HTMLElement && node.classList.contains(NOTIFICATION_CLASS)) {
					history.push(
						node.querySelector(NOTIFICATION_MESSAGE_SELECTOR)?.textContent?.trim() ?? ''
					);
				}
			}
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });
	return history;
};

const facilityMarkerElements = (container: HTMLElement): readonly Element[] =>
	Array.from(container.querySelectorAll('.leaflet-marker-pane .facility-marker'));

export async function renderApp(options: RenderOptions = {}): Promise<AppHandle> {
	blurFocusedElement();
	document.body.innerHTML = '';
	const container = document.createElement('div');
	container.id = 'map';
	document.body.appendChild(container);

	const toastHistory = observeToastHistory();

	const overpass = fakeOverpass(options.overpass ?? (() => WATER_ELEMENTS));
	const geolocation = fakeGeolocation(options.geolocation ?? { position: USER });
	installPermissionsFake(options.permission ?? 'prompt');
	if (options.rememberedPosition !== undefined) {
		seedRememberedPosition(options.rememberedPosition);
	}

	vi.resetModules();
	await import('../src/index');

	await waitFor(() => expect(container.classList.contains('leaflet-container')).toBe(true));
	const isReload = options.reload === true;
	if (!isReload) {
		await waitFor(() => expect(overpass.requests.length).toBeGreaterThan(0));
	}
	const settled = async (): Promise<void> => {
		await waitFor(() => expect(overpass.pendingRequestCount).toBe(0));
		await flushMicrotasks();
	};
	if (options.settle !== false) {
		await settled();
	}

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

	const locateButton = (): HTMLButtonElement => {
		const button = container.querySelector('.locate-control button');
		if (!(button instanceof HTMLButtonElement)) {
			throw new Error('Locate button is not on the page');
		}
		return button;
	};

	const dispatchArrowKey = (direction: PanDirection, far: boolean): void => {
		container.focus();
		const event = new KeyboardEvent('keydown', { bubbles: true, shiftKey: far });
		Object.defineProperty(event, 'keyCode', { value: PAN_KEY_CODES[direction] });
		document.dispatchEvent(event);
	};

	const hudButton = (): HTMLButtonElement | null => {
		const button = container.querySelector('.nearest-hud');
		return button instanceof HTMLButtonElement ? button : null;
	};

	return {
		container,
		overpass,
		geolocation,
		markers: () => facilityMarkerElements(container),
		userLocation: () => ({
			markers: container.querySelectorAll('.leaflet-marker-pane .user-location-marker').length,
			circles: container.querySelectorAll(
				`.leaflet-overlay-pane path[stroke="${USER_ACCURACY_CIRCLE_STROKE_COLOR}"]:not(.beeline)`
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
		locateButton,
		clickLocate: () => clickOn(locateButton(), 'Locate button'),
		zoomIn: () => clickOn(container.querySelector('.leaflet-control-zoom-in'), 'Zoom in button'),
		zoomOut: () => clickOn(container.querySelector('.leaflet-control-zoom-out'), 'Zoom out button'),
		pan: (direction, { far = true } = {}) => dispatchArrowKey(direction, far),
		pressArrowKey: (direction) => dispatchArrowKey(direction, true),
		openPopupOf: (index) =>
			clickOn(facilityMarkerElements(container)[index] ?? null, `Marker #${index}`),
		closePopup: () =>
			clickOn(container.querySelector('.leaflet-popup-close-button'), 'Popup close button'),
		popup,
		popupText: () => popup()?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
		hud: () => {
			const button = hudButton();
			if (button === null || button.hidden) {
				return null;
			}
			return button.querySelector('.nearest-hud-text')?.textContent?.trim() ?? null;
		},
		clickHud: () => clickOn(hudButton(), 'Nearest HUD'),
		beelineVisible: () => container.querySelector('.leaflet-overlay-pane path.beeline') !== null,
		snapshot: () => readCacheRecord(),
	};
}
