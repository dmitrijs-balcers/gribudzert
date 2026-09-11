import { fireEvent, waitFor } from '@testing-library/dom';
import * as L from 'leaflet';
import { expect, vi } from 'vitest';
import { FACILITY_CACHE_DB_NAME, LAST_POSITION_STORAGE_KEY } from '../src/core/config';
import type { Connectivity } from '../src/domain';
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

export type OnLineFake = {
	readonly goOffline: () => void;
	readonly goOnline: () => void;
};

export const installOnLineFake = (connectivity: Connectivity): OnLineFake => {
	let onLine = connectivity === 'online';
	Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => onLine });
	return {
		goOffline: () => {
			onLine = false;
			window.dispatchEvent(new Event('offline'));
		},
		goOnline: () => {
			onLine = true;
			window.dispatchEvent(new Event('online'));
		},
	};
};

const fakeMediaQueryList = (query: string, matches: boolean): MediaQueryList =>
	({
		matches,
		media: query,
		onchange: null,
		addListener: () => undefined,
		removeListener: () => undefined,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		dispatchEvent: () => false,
	}) as MediaQueryList;

export type PointerKind = 'coarse' | 'fine';
export type DisplayMode = 'browser' | 'standalone';

const mediaQueryMatches = (
	query: string,
	pointer: PointerKind,
	displayMode: DisplayMode
): boolean =>
	query.includes(`pointer: ${pointer}`) ||
	(displayMode === 'standalone' && query.includes('display-mode: standalone'));

export const installMatchMediaFake = (pointer: PointerKind, displayMode: DisplayMode): void => {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: (query: string) =>
			fakeMediaQueryList(query, mediaQueryMatches(query, pointer, displayMode)),
	});
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

type IndexedDbOpenRequestHandlers = {
	onsuccess: ((event: Event) => void) | null;
	onerror: ((event: Event) => void) | null;
	onblocked: ((event: Event) => void) | null;
	onupgradeneeded: ((event: Event) => void) | null;
	readonly result: IDBDatabase;
	readonly error: DOMException | null;
};

export const makeIndexedDbOpenSlow = (delayMs: number): (() => void) => {
	const realOpen = indexedDB.open.bind(indexedDB);
	const slowOpen = (name: string, version?: number): IDBOpenDBRequest => {
		const real = realOpen(name, version);
		const proxy: IndexedDbOpenRequestHandlers = {
			onsuccess: null,
			onerror: null,
			onblocked: null,
			onupgradeneeded: null,
			get result() {
				return real.result;
			},
			get error() {
				return real.error;
			},
		};
		real.onupgradeneeded = (event) => proxy.onupgradeneeded?.(event);
		real.onsuccess = (event) => {
			setTimeout(() => proxy.onsuccess?.(event), delayMs);
		};
		real.onerror = (event) => proxy.onerror?.(event);
		return proxy as unknown as IDBOpenDBRequest;
	};
	indexedDB.open = slowOpen as typeof indexedDB.open;
	return () => {
		indexedDB.open = realOpen as typeof indexedDB.open;
	};
};

const USER_ACCURACY_CIRCLE_STROKE_COLOR = '#136AEC';

export type PanDirection = 'left' | 'up' | 'right' | 'down';

const PAN_KEY_CODES: Readonly<Record<PanDirection, number>> = {
	left: 37,
	up: 38,
	right: 39,
	down: 40,
};

const PAN_KEYS: Readonly<
	Record<PanDirection, 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'>
> = {
	left: 'ArrowLeft',
	up: 'ArrowUp',
	right: 'ArrowRight',
	down: 'ArrowDown',
};

const PAN_ANIMATION_CLASS = 'leaflet-pan-anim';
const PAN_ANIMATION_POLL_MS = 10;
const PAN_ANIMATION_START_GRACE_POLLS = 5;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const mapPaneOf = (container: HTMLElement): Element | null =>
	container.querySelector('.leaflet-map-pane');

const isPanAnimating = (container: HTMLElement): boolean =>
	mapPaneOf(container)?.classList.contains(PAN_ANIMATION_CLASS) ?? false;

const waitWhilePanAnimating = async (container: HTMLElement): Promise<void> => {
	while (isPanAnimating(container)) {
		await sleep(PAN_ANIMATION_POLL_MS);
	}
};

const panAnimationHasStarted = async (container: HTMLElement): Promise<boolean> => {
	for (let poll = 0; poll < PAN_ANIMATION_START_GRACE_POLLS; poll += 1) {
		if (isPanAnimating(container)) {
			return true;
		}
		await sleep(PAN_ANIMATION_POLL_MS);
	}
	return isPanAnimating(container);
};

export type AppHandle = {
	readonly container: HTMLElement;
	readonly overpass: OverpassFake;
	readonly geolocation: GeolocationFake;
	readonly markers: () => readonly Element[];
	readonly userLocation: () => { markers: number; circles: number };
	readonly toasts: () => readonly string[];
	readonly toastHistory: () => readonly string[];
	readonly status: () => string | null;
	readonly card: () => { readonly message: string; readonly action: string | null } | null;
	readonly settled: () => Promise<void>;
	readonly layerSwitch: (label: string) => HTMLButtonElement;
	readonly isLayerOn: (label: string) => boolean;
	readonly toggleLayer: (label: string) => void;
	readonly locateButton: () => HTMLButtonElement;
	readonly clickLocate: () => void;
	readonly zoomIn: () => void;
	readonly zoomOut: () => void;
	readonly pan: (direction: PanDirection, options?: { readonly far?: boolean }) => Promise<void>;
	readonly pressArrowKey: (direction: PanDirection) => Promise<void>;
	readonly tapMarker: (index: number) => void;
	readonly closeSheet: () => void;
	readonly expandSheet: () => void;
	readonly sheet: () => HTMLElement | null;
	readonly sheetText: () => string;
	readonly hud: () => string | null;
	readonly clickHud: () => void;
	readonly stopGuiding: () => void;
	readonly beelineVisible: () => boolean;
	readonly snapshot: () => Promise<unknown>;
	readonly provenance: () => string | null;
	readonly goOffline: () => void;
	readonly goOnline: () => void;
	readonly zoomControlVisible: () => boolean;
	readonly tileZoom: () => number | null;
	readonly draggingEnabled: () => boolean;
	readonly gesturePointer: (
		type: GesturePointerType,
		point: { x: number; y: number },
		pointerId?: number
	) => boolean;
};

export type Device = 'iphone' | 'android' | 'desktop';

const USER_AGENTS: Readonly<Record<Device, string>> = {
	iphone:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1',
	android:
		'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
	desktop:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

export const installUserAgentFake = (device: Device): void => {
	Object.defineProperty(navigator, 'userAgent', { configurable: true, value: USER_AGENTS[device] });
};

export type RenderOptions = {
	readonly device?: Device;
	readonly geolocation?: GeoOutcome;
	readonly overpass?: OverpassHandler;
	readonly settle?: boolean;
	readonly reload?: boolean;
	readonly permission?: Permission;
	readonly rememberedPosition?: GeoPosition & { readonly ageMs?: number };
	readonly connectivity?: Connectivity;
	readonly pointer?: PointerKind;
	readonly displayMode?: DisplayMode;
	readonly splash?: boolean;
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

const NOTICE_CLASS = 'notice';
const NOTICE_MESSAGE_SELECTOR = '.notice-message';

const observeToastHistory = (): readonly string[] => {
	const history: string[] = [];
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of Array.from(mutation.addedNodes)) {
				if (node instanceof HTMLElement && node.classList.contains(NOTICE_CLASS)) {
					history.push(node.querySelector(NOTICE_MESSAGE_SELECTOR)?.textContent?.trim() ?? '');
				}
			}
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });
	return history;
};

const facilityMarkerElements = (container: HTMLElement): readonly Element[] =>
	Array.from(container.querySelectorAll('.leaflet-marker-pane .facility-marker'));

export type GesturePointerType = 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel';

const dispatchGesturePointer = (
	container: HTMLElement,
	type: GesturePointerType,
	point: { readonly x: number; readonly y: number },
	pointerId: number
): boolean =>
	container.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			clientX: point.x,
			clientY: point.y,
			pointerId,
			isPrimary: true,
			pointerType: 'touch',
		})
	);

const TILE_ZOOM_PATTERN = /tile\.openstreetmap\.org\/(\d+)\//;

const zoomOfTopmostTileLevel = (container: HTMLElement): number | null => {
	const levels = Array.from(
		container.querySelectorAll<HTMLElement>('.leaflet-tile-pane .leaflet-tile-container')
	);
	const topLevel = levels.reduce<HTMLElement | null>(
		(top, level) =>
			top === null || Number(level.style.zIndex) > Number(top.style.zIndex) ? level : top,
		null
	);
	const image = topLevel?.querySelector<HTMLImageElement>('img.leaflet-tile') ?? null;
	const match = image === null ? null : TILE_ZOOM_PATTERN.exec(image.src);
	return match?.[1] === undefined ? null : Number(match[1]);
};

let mostRecentlyRenderedApp: { readonly dispose: () => void } | null = null;

export const disposePreviousApp = (): void => {
	mostRecentlyRenderedApp?.dispose();
	mostRecentlyRenderedApp = null;
};

export async function renderApp(options: RenderOptions = {}): Promise<AppHandle> {
	disposePreviousApp();
	blurFocusedElement();
	document.body.innerHTML = '';
	if (options.splash === true) {
		const splash = document.createElement('div');
		splash.id = 'splash';
		document.body.appendChild(splash);
	}
	const container = document.createElement('div');
	container.id = 'map';
	document.body.appendChild(container);

	const toastHistory = observeToastHistory();

	const overpass = fakeOverpass(options.overpass ?? (() => WATER_ELEMENTS));
	const geolocation = fakeGeolocation(options.geolocation ?? { position: USER });
	installPermissionsFake(options.permission ?? 'prompt');
	const connectivity = options.connectivity ?? 'online';
	const onLineFake = installOnLineFake(connectivity);
	installMatchMediaFake(options.pointer ?? 'fine', options.displayMode ?? 'browser');
	if (options.device !== undefined) {
		installUserAgentFake(options.device);
	}
	if (options.rememberedPosition !== undefined) {
		seedRememberedPosition(options.rememberedPosition);
	}

	vi.resetModules();
	const { bootstrap } = await import('../src/app');
	mostRecentlyRenderedApp = bootstrap();

	await waitFor(() => expect(container.classList.contains('leaflet-container')).toBe(true));
	const isReload = options.reload === true;
	if (!isReload && connectivity === 'online') {
		await waitFor(() => expect(overpass.requests.length).toBeGreaterThan(0));
	}
	const settled = async (): Promise<void> => {
		await waitFor(() => expect(overpass.pendingRequestCount).toBe(0));
		await flushMicrotasks();
	};
	if (options.settle !== false) {
		await settled();
	}

	const sheet = (): HTMLElement | null => {
		const root = container.querySelector<HTMLElement>('.detail-sheet');
		return root !== null && !root.hidden ? root : null;
	};

	const layerPickerButton = (): HTMLButtonElement => {
		const button = container.querySelector('.layer-picker-button');
		if (!(button instanceof HTMLButtonElement)) {
			throw new Error('Layer picker button is not on the page');
		}
		return button;
	};

	const layerPickerPopover = (): HTMLElement | null =>
		container.querySelector<HTMLElement>('.layer-picker-popover');

	const openLayerPicker = (): void => {
		const popover = layerPickerPopover();
		if (popover === null || popover.hidden) {
			clickOn(layerPickerButton(), 'Layer picker button');
		}
	};

	const layerSwitch = (label: string): HTMLButtonElement => {
		openLayerPicker();
		const tiles = Array.from(container.querySelectorAll<HTMLButtonElement>('.layer-picker-tile'));
		const match = tiles.find(
			(tile) => tile.querySelector('.layer-picker-tile-label')?.textContent?.trim() === label
		);
		if (match === undefined) {
			throw new Error(`No "${label}" layer in the layer picker`);
		}
		return match;
	};

	const isLayerOn = (label: string): boolean =>
		layerSwitch(label).getAttribute('aria-checked') === 'true';

	const locateButton = (): HTMLButtonElement => {
		const button = container.querySelector('.locate-control button');
		if (!(button instanceof HTMLButtonElement)) {
			throw new Error('Locate button is not on the page');
		}
		return button;
	};

	const dispatchArrowKey = async (direction: PanDirection, far: boolean): Promise<void> => {
		await waitWhilePanAnimating(container);
		container.focus();
		const event = new KeyboardEvent('keydown', {
			bubbles: true,
			shiftKey: far,
			key: PAN_KEYS[direction],
		});
		Object.defineProperty(event, 'keyCode', { value: PAN_KEY_CODES[direction] });
		document.dispatchEvent(event);
		if (await panAnimationHasStarted(container)) {
			await waitWhilePanAnimating(container);
		}
	};

	const hudRoot = (): HTMLElement | null => {
		const root = container.querySelector('.guidance-hud');
		return root instanceof HTMLElement && !root.hidden ? root : null;
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
			Array.from(document.querySelectorAll('.notice:not(.notice-leaving) .notice-message')).map(
				(element) => element.textContent?.trim() ?? ''
			),
		toastHistory: () => toastHistory,
		status: () =>
			document
				.querySelector('.notice-status:not(.notice-leaving) .notice-message')
				?.textContent?.trim() ?? null,
		card: () => {
			const element = document.querySelector('.notice-card:not(.notice-leaving)');
			if (element === null) {
				return null;
			}
			const message = element.querySelector('.notice-message')?.textContent?.trim() ?? '';
			const action = element.querySelector('.notice-action')?.textContent?.trim() ?? null;
			return { message, action };
		},
		settled,
		layerSwitch,
		isLayerOn,
		toggleLayer: (label) => clickOn(layerSwitch(label), `"${label}" tile`),
		locateButton,
		clickLocate: () => clickOn(locateButton(), 'Locate button'),
		zoomIn: () => clickOn(container.querySelector('.leaflet-control-zoom-in'), 'Zoom in button'),
		zoomOut: () => clickOn(container.querySelector('.leaflet-control-zoom-out'), 'Zoom out button'),
		pan: (direction, { far = true } = {}) => dispatchArrowKey(direction, far),
		pressArrowKey: (direction) => dispatchArrowKey(direction, true),
		tapMarker: (index) =>
			clickOn(facilityMarkerElements(container)[index] ?? null, `Marker #${index}`),
		closeSheet: () =>
			clickOn(sheet()?.querySelector('.detail-sheet-close') ?? null, 'Sheet close button'),
		expandSheet: () =>
			clickOn(sheet()?.querySelector('.detail-sheet-details') ?? null, 'Sheet details button'),
		sheet,
		sheetText: () => sheet()?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
		hud: () => hudRoot()?.querySelector('.guidance-hud-text')?.textContent?.trim() ?? null,
		clickHud: () =>
			clickOn(hudRoot()?.querySelector('.guidance-hud-target') ?? null, 'Guidance HUD'),
		stopGuiding: () =>
			clickOn(hudRoot()?.querySelector('.guidance-hud-dismiss') ?? null, 'Stop guiding button'),
		beelineVisible: () => container.querySelector('.leaflet-overlay-pane path.beeline') !== null,
		snapshot: () => readCacheRecord(),
		provenance: () => {
			const element = container.querySelector('.provenance-indicator');
			if (!(element instanceof HTMLElement) || element.hidden) {
				return null;
			}
			return element.getAttribute('data-provenance');
		},
		goOffline: onLineFake.goOffline,
		goOnline: onLineFake.goOnline,
		zoomControlVisible: () => container.querySelector('.leaflet-control-zoom-in') !== null,
		tileZoom: () => zoomOfTopmostTileLevel(container),
		draggingEnabled: () => container.classList.contains('leaflet-grab'),
		gesturePointer: (type, point, pointerId = 1) =>
			dispatchGesturePointer(container, type, point, pointerId),
	};
}
