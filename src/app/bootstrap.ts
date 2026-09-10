import * as L from 'leaflet';
import {
	trackAreaExplored,
	trackEmptyArea,
	trackLayerDisabled,
	trackLayerEnabled,
	trackLocateFailed,
	trackLocateRequested,
	trackLocateSuccess,
	trackMapLoaded,
} from '../analytics';
import {
	CACHE_WARMUP_TIMEOUT_MS,
	DEFAULT_ZOOM,
	LOCATE_ZOOM,
	MAX_ZOOM,
	OSM_ATTRIBUTION,
	OSM_TILE_URL,
	RERANK_MIN_MOVE_M,
	RIGA_CENTER,
} from '../core/config';
import type {
	Facility,
	LatLon,
	Located,
	UserPosition,
	Viewport,
	WaterFacility,
	Zoom,
} from '../domain';
import {
	bearingBetween,
	compassPointOf,
	distanceBetween,
	isWaterFacility,
	timestampNow,
	zoom,
} from '../domain';
import { defaultSnapshotStore, snapshotFrom } from '../features/cache';
import type { Snapshot } from '../features/cache/snapshot';
import { currentConnectivity, observeConnectivity } from '../features/connectivity';
import { composeQuery, fetchFacilities, overpassSelector } from '../features/data';
import type {
	BeelineLayer,
	FollowController,
	LocationTracker,
	UserLocationLayer,
} from '../features/location';
import {
	createBeelineLayer,
	createFollowController,
	createLocationTracker,
	createUserLocationLayer,
	loadLastKnownPosition,
	saveLastKnownPosition,
} from '../features/location';
import type { FollowMode } from '../features/location/follow';
import type { TrackingState } from '../features/location/tracker';
import { addMarkers } from '../features/markers/markers';
import { toTileBounds } from '../features/navigation/bounds';
import { createUserInteractionSource } from '../features/navigation/user-interaction';
import { createOneHandZoomHandler } from '../features/zoom-gesture';
import drinkingWater from '../oql/drinking_water.overpassql?raw';
import publicToilets from '../oql/public_toilets.overpassql?raw';
import { toLocationFailureCategory } from '../types/errors';
import { initInstallPrompt } from '../ui/install-prompt';
import { hideLoading, resetLoading, showLoading } from '../ui/loading';
import type { LocateButtonView, LocateControl } from '../ui/locate-control';
import { createLocateControl } from '../ui/locate-control';
import { createNearestHud } from '../ui/nearest-hud';
import { createProvenanceIndicator } from '../ui/provenance-indicator';
import { dismissSplash } from '../ui/splash';
import { isCoarsePointer } from '../utils/dom';
import * as logger from '../utils/logger';
import type { FacilityLayer, FacilityLayers, LayerKind } from './layers';
import {
	activeLayerCount,
	createFacilityLayers,
	disableLayer,
	enableLayer,
	LAYER_KINDS,
	layerKindOf,
} from './layers';
import {
	INITIALIZATION_FAILED_MESSAGE,
	INITIALIZATION_REFRESH_ACTION_LABEL,
	LOCATION_FALLBACK_MESSAGE,
	locationErrorMessage,
	OFFLINE_STATUS_MESSAGE,
} from './messages';
import type { InstalledNoticeCenter, NoticeCenter } from './notices';
import { installNoticeCenter } from './notices';
import { registerServiceWorker } from './service-worker-client';
import type { LayerRender, SyncRuntime } from './sync';
import { createSyncRuntime, initialSyncState } from './sync';

export const MAP_CONTAINER_ID = 'map';

const NEAREST_WATER_GLYPH = '🚰';

const VIEWPORT_DEBOUNCE_MS = 300;

const awaitCacheReadyOrTimeout = async (ready: Promise<unknown>): Promise<void> => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timedOut = new Promise<'timeout'>((resolve) => {
		timer = setTimeout(() => resolve('timeout'), CACHE_WARMUP_TIMEOUT_MS);
	});
	const outcome = await Promise.race([ready.then((): 'ready' => 'ready'), timedOut]);
	clearTimeout(timer);
	if (outcome === 'timeout') {
		logger.warn(
			`Facility cache load timed out after ${CACHE_WARMUP_TIMEOUT_MS}ms; continuing without it`
		);
	}
};

const requireZoom = (value: number): Zoom => {
	const validated = zoom(Math.round(value));
	if (validated === null) {
		throw new Error(`Invalid map zoom: ${value}`);
	}
	return validated;
};

const viewportOf = (map: L.Map): Viewport => {
	const center = map.getCenter();
	return {
		bounds: toTileBounds(map.getBounds()),
		zoom: requireZoom(map.getZoom()),
		center: { lat: center.lat, lon: center.lng },
	};
};

export const mapOptionsFor = (input: {
	readonly coarsePointer: boolean;
	readonly center: L.LatLngTuple;
}): L.MapOptions => ({
	center: input.center,
	zoom: DEFAULT_ZOOM,
	zoomControl: !input.coarsePointer,
	zoomSnap: input.coarsePointer ? 0 : 1,
});

const createMap = (center: L.LatLngTuple, coarsePointer: boolean): L.Map => {
	const map = L.map(MAP_CONTAINER_ID, mapOptionsFor({ coarsePointer, center }));
	L.tileLayer(OSM_TILE_URL, {
		maxZoom: MAX_ZOOM,
		attribution: OSM_ATTRIBUTION,
		crossOrigin: 'anonymous',
	}).addTo(map);
	L.control.scale({ metric: true, imperial: false }).addTo(map);
	return map;
};

const addLayerControl = (map: L.Map, layers: FacilityLayers): void => {
	L.control
		.layers(
			undefined,
			{
				[layers.water.label]: layers.water.group,
				[layers.toilet.label]: layers.toilet.group,
			},
			{ collapsed: false }
		)
		.addTo(map);
};

const toLocatedWater = (item: Located<Facility>): Located<WaterFacility> | null =>
	isWaterFacility(item.facility)
		? { facility: item.facility, distance: item.distance, isNearest: item.isNearest }
		: null;

const isMarkerAt = (layer: L.Layer, coordinates: LatLon): layer is L.Marker => {
	if (!(layer instanceof L.Marker)) {
		return false;
	}
	const latLng = layer.getLatLng();
	return latLng.lat === coordinates.lat && latLng.lng === coordinates.lon;
};

const findMarkerAt = (group: L.FeatureGroup<L.Marker>, coordinates: LatLon): L.Marker | null =>
	group.getLayers().find((layer): layer is L.Marker => isMarkerAt(layer, coordinates)) ?? null;

const locateButtonViewOf = (state: TrackingState, follow: FollowMode): LocateButtonView => {
	switch (state.kind) {
		case 'idle':
			return { kind: 'idle' };
		case 'acquiring':
			return { kind: 'acquiring' };
		case 'tracking':
			return { kind: 'tracking', follow };
		case 'paused':
			return state.lastKnown === null ? { kind: 'acquiring' } : { kind: 'tracking', follow };
		case 'failed':
			return state.error.type === 'permission-denied' ? { kind: 'blocked' } : { kind: 'failed' };
		default: {
			const exhaustive: never = state;
			return exhaustive;
		}
	}
};

const onceSettled = (
	tracker: LocationTracker,
	onSettled: (state: Extract<TrackingState, { kind: 'tracking' | 'failed' }>) => void
): void => {
	const stop = tracker.subscribe((state) => {
		if (state.kind !== 'tracking' && state.kind !== 'failed') {
			return;
		}
		stop();
		onSettled(state);
	});
};

const reportPressOutcome = (tracker: LocationTracker, notices: NoticeCenter): void => {
	onceSettled(tracker, (state) => {
		if (state.kind === 'tracking') {
			trackLocateSuccess();
			return;
		}
		trackLocateFailed(toLocationFailureCategory(state.error));
		notices.toast(locationErrorMessage(state.error), 'error');
	});
};

const onLocateActivate = (
	tracker: LocationTracker,
	followController: FollowController,
	notices: NoticeCenter
): void => {
	trackLocateRequested();
	const state = tracker.state();
	switch (state.kind) {
		case 'idle':
		case 'failed':
			reportPressOutcome(tracker, notices);
			tracker.start();
			followController.follow('flyTo');
			return;
		case 'paused':
			tracker.start();
			return;
		case 'acquiring':
			return;
		case 'tracking':
			if (followController.mode() === 'on') {
				followController.unfollow();
			} else {
				followController.follow('flyTo');
			}
			return;
		default: {
			const exhaustive: never = state;
			throw new Error(`Unhandled tracking state: ${JSON.stringify(exhaustive)}`);
		}
	}
};

const needsReranking = (
	popupOpen: boolean,
	rankedFrom: LatLon | null,
	position: LatLon
): boolean => {
	if (popupOpen) {
		return false;
	}
	if (rankedFrom === null) {
		return true;
	}
	return distanceBetween(rankedFrom, position) >= RERANK_MIN_MOVE_M;
};

type Teardown = () => void;

/**
 * Collects everything the app must undo when it goes away: map, timers, subscriptions.
 * Runs them in reverse order of registration; a teardown added after disposal runs at once,
 * so a bootstrap that is still in flight when the app is disposed cannot leak.
 */
const createTeardowns = (): {
	readonly add: (teardown: Teardown) => void;
	readonly run: Teardown;
} => {
	const teardowns: Teardown[] = [];
	let disposed = false;
	const runSafely = (teardown: Teardown): void => {
		try {
			teardown();
		} catch (error) {
			logger.error('App teardown failed:', error instanceof Error ? error.message : error);
		}
	};
	return {
		add: (teardown) => {
			if (disposed) {
				runSafely(teardown);
				return;
			}
			teardowns.push(teardown);
		},
		run: () => {
			if (disposed) {
				return;
			}
			disposed = true;
			for (const teardown of teardowns.reverse()) {
				runSafely(teardown);
			}
			teardowns.length = 0;
		},
	};
};

const bootstrapOrThrow = async (
	notices: NoticeCenter,
	onTeardown: (teardown: Teardown) => void
): Promise<void> => {
	const remembered = loadLastKnownPosition(localStorage, timestampNow());

	const center: L.LatLngTuple =
		remembered === null ? RIGA_CENTER : [remembered.lat, remembered.lon];
	const coarsePointer = isCoarsePointer();
	const map = createMap(center, coarsePointer);
	onTeardown(() => map.remove());
	registerServiceWorker(notices);
	initInstallPrompt(localStorage);

	if (currentConnectivity(navigator) === 'offline') {
		notices.status(OFFLINE_STATUS_MESSAGE, 'warning');
	}

	const userInteraction = createUserInteractionSource(map);
	if (coarsePointer) {
		createOneHandZoomHandler(map, userInteraction.notifyUserMovedMap).enable();
	}

	const provenanceIndicator = createProvenanceIndicator('topleft');
	provenanceIndicator.control.addTo(map);

	const layers = createFacilityLayers({
		water: overpassSelector(drinkingWater),
		toilet: overpassSelector(publicToilets),
	});

	const userLayer: UserLocationLayer = createUserLocationLayer(map);
	const beelineLayer: BeelineLayer = createBeelineLayer(map);
	if (remembered !== null) {
		userLayer.show(remembered, 'stale');
	}

	let nearestWater: Located<WaterFacility> | null = null;
	let lastPosition: UserPosition | null = null;
	let popupOpen = false;
	let rankedFrom: LatLon | null = null;

	const refreshHudAndBeeline = (position: UserPosition): void => {
		if (nearestWater === null || !layers.water.active) {
			hud.render({ kind: 'hidden' });
			beelineLayer.clear();
			return;
		}
		const to = nearestWater.facility.coordinates;
		const bearing = bearingBetween(position, to);
		hud.render({
			kind: 'shown',
			distance: distanceBetween(position, to),
			bearing,
			glyph: NEAREST_WATER_GLYPH,
			label: compassPointOf(bearing),
		});
		beelineLayer.show(position, to);
	};

	const flyToNearestWaterAndOpenPopup = (): void => {
		if (nearestWater === null) {
			return;
		}
		const coordinates = nearestWater.facility.coordinates;
		map.flyTo([coordinates.lat, coordinates.lon], Math.max(map.getZoom(), LOCATE_ZOOM));
		findMarkerAt(layers.water.group, coordinates)?.openPopup();
	};

	const hud = createNearestHud(map, () => {
		followController.unfollow();
		flyToNearestWaterAndOpenPopup();
	});

	const reportNearest = (kind: LayerKind, nearest: Located<Facility> | null): void => {
		if (kind !== 'water') {
			return;
		}
		nearestWater = nearest === null ? null : toLocatedWater(nearest);
		if (lastPosition !== null) {
			refreshHudAndBeeline(lastPosition);
		}
	};

	const store = defaultSnapshotStore();
	let saveChain: Promise<void> = Promise.resolve();
	const persist = (snapshot: Snapshot): void => {
		saveChain = saveChain
			.then(() => store.save(snapshot))
			.catch((error: unknown) => {
				logger.error('Facility cache persist failed', error);
			});
	};

	const render = (renders: readonly LayerRender[]): void => {
		for (const layerRender of renders) {
			const layer = layers[layerRender.kind];
			layer.group.clearLayers();
			addMarkers(layerRender.items, layer.group);
		}
	};

	const clearRenderAll = (): void => {
		for (const kind of LAYER_KINDS) {
			layers[kind].group.clearLayers();
		}
	};

	const runtime: SyncRuntime = createSyncRuntime(
		{
			now: timestampNow,
			queryFor: (kinds) => composeQuery(kinds.map((kind) => layers[kind].selector)),
			fetchFacilities,
			render,
			clearRender: clearRenderAll,
			notify: notices.announce,
			clearStatus: notices.clearStatus,
			showLoading,
			hideLoading,
			persist,
			reportNearest,
			trackAreaExplored,
			trackEmptyArea,
			reportProvenance: provenanceIndicator.render,
		},
		initialSyncState(timestampNow(), undefined, currentConnectivity(navigator))
	);

	const mapContainerStillMounted = (): boolean => document.body.contains(map.getContainer());
	const dispatchWhileMounted: SyncRuntime['dispatch'] = (event) => {
		if (mapContainerStillMounted()) {
			runtime.dispatch(event);
		}
	};

	onTeardown(
		observeConnectivity(window, navigator, (connectivity) => {
			dispatchWhileMounted({ kind: 'connectivity-changed', connectivity });
		})
	);

	const cacheLoad = store.load().then(snapshotFrom);
	let cacheReadyDispatched = false;
	const dispatchCacheReadyOnce = (snapshot: Snapshot): void => {
		if (cacheReadyDispatched) {
			return;
		}
		cacheReadyDispatched = true;
		dispatchWhileMounted({ kind: 'cache-ready', snapshot });
	};
	await awaitCacheReadyOrTimeout(cacheLoad.then(dispatchCacheReadyOnce));
	cacheLoad.then(dispatchCacheReadyOnce);

	const dispatchOriginIfNeeded = (position: LatLon): void => {
		if (needsReranking(popupOpen, rankedFrom, position)) {
			rankedFrom = position;
			dispatchWhileMounted({ kind: 'origin-moved', position });
		}
	};

	const tracker = createLocationTracker();
	onTeardown(() => tracker.stop());

	const renderLocateButton = (): void => {
		locateControl.render(locateButtonViewOf(tracker.state(), followController.mode()));
	};

	const followController = createFollowController(map, tracker, userInteraction, () => {
		renderLocateButton();
	});

	const locateControl: LocateControl = createLocateControl(() =>
		onLocateActivate(tracker, followController, notices)
	);
	locateControl.control.addTo(map);
	followController.follow('setView');

	if (remembered !== null) {
		trackMapLoaded('user');
	} else {
		onceSettled(tracker, (state) => {
			trackMapLoaded(state.kind === 'tracking' ? 'user' : 'default');
			if (state.kind === 'failed') {
				notices.toast(LOCATION_FALLBACK_MESSAGE);
			}
		});
	}

	tracker.subscribe((state) => {
		renderLocateButton();

		if (state.kind !== 'tracking') {
			return;
		}

		const position = state.position;
		lastPosition = position;
		userLayer.show(position, state.freshness);
		saveLastKnownPosition(localStorage, position);
		refreshHudAndBeeline(position);
		dispatchOriginIfNeeded(position);
	});

	map.on('popupopen', () => {
		popupOpen = true;
	});
	map.on('popupclose', () => {
		popupOpen = false;
		if (lastPosition !== null) {
			dispatchOriginIfNeeded(lastPosition);
		}
	});

	tracker.start();

	const onWaterLayerDisabled = (): void => {
		nearestWater = null;
		hud.render({ kind: 'hidden' });
		beelineLayer.clear();
	};

	const layerFor = (
		event: L.LayersControlEvent
	): { readonly kind: LayerKind; readonly layer: FacilityLayer } | null => {
		const kind = layerKindOf(event.name);
		return kind === null ? null : { kind, layer: layers[kind] };
	};

	map.on('overlayadd', (event: L.LayersControlEvent) => {
		const target = layerFor(event);
		if (target === null) {
			return;
		}
		enableLayer(target.layer, map);
		trackLayerEnabled(target.layer.label, activeLayerCount(layers));
		dispatchWhileMounted({ kind: 'layer-toggled', layer: target.kind, active: true });
	});
	map.on('overlayremove', (event: L.LayersControlEvent) => {
		const target = layerFor(event);
		if (target === null) {
			return;
		}
		disableLayer(target.layer, map);
		trackLayerDisabled(target.layer.label, activeLayerCount(layers));
		dispatchWhileMounted({ kind: 'layer-toggled', layer: target.kind, active: false });
		if (target.kind === 'water') {
			onWaterLayerDisabled();
		}
	});

	enableLayer(layers.water, map);
	addLayerControl(map, layers);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	const cancelPendingViewportDispatch = (): void => {
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
	};
	onTeardown(cancelPendingViewportDispatch);
	map.on('movestart', cancelPendingViewportDispatch);
	map.on('dragstart', cancelPendingViewportDispatch);
	map.on('moveend', () => {
		cancelPendingViewportDispatch();
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			dispatchWhileMounted({ kind: 'viewport-settled', viewport: viewportOf(map) });
		}, VIEWPORT_DEBOUNCE_MS);
	});

	dispatchWhileMounted({ kind: 'viewport-settled', viewport: viewportOf(map) });

	logger.info('App initialization complete');
};

/**
 * A running app. `ready` settles once initialisation has finished (it never rejects: a
 * failure is shown to the user instead). `dispose` tears the app down: the map, its
 * timers and subscriptions, and the notice centre. Safe to call more than once.
 */
export type AppHandle = {
	readonly ready: Promise<void>;
	readonly dispose: () => void;
};

const runBootstrap = async (
	notices: NoticeCenter,
	onTeardown: (t: Teardown) => void
): Promise<void> => {
	try {
		await bootstrapOrThrow(notices, onTeardown);
	} catch (error) {
		resetLoading();
		notices.card(
			INITIALIZATION_FAILED_MESSAGE,
			{ label: INITIALIZATION_REFRESH_ACTION_LABEL, onSelect: () => location.reload() },
			'error'
		);
		logger.error('App initialization error:', error instanceof Error ? error.message : error);
	} finally {
		dismissSplash();
	}
};

export function bootstrap(): AppHandle {
	const teardowns = createTeardowns();
	const installed: InstalledNoticeCenter = installNoticeCenter(document.body, timestampNow);
	teardowns.add(installed.destroy);
	const ready = runBootstrap(installed.center, teardowns.add);
	return { ready, dispose: teardowns.run };
}
