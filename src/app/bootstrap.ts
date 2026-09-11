import * as L from 'leaflet';
import {
	trackAreaExplored,
	trackEmptyArea,
	trackGuidanceStarted,
	trackLayerDisabled,
	trackLayerEnabled,
	trackMapLoaded,
	trackNavigationStarted,
} from '../analytics';
import {
	CACHE_WARMUP_TIMEOUT_MS,
	DEFAULT_ZOOM,
	LOCATE_ZOOM,
	MAX_ZOOM,
	OSM_ATTRIBUTION,
	OSM_TILE_URL,
	RIGA_CENTER,
} from '../core/config';
import type { Facility, Located, Viewport, Zoom } from '../domain';
import { timestampNow, zoom } from '../domain';
import { defaultSnapshotStore, snapshotFrom } from '../features/cache';
import type { Snapshot } from '../features/cache/snapshot';
import { currentConnectivity, observeConnectivity } from '../features/connectivity';
import { composeQuery, fetchFacilities, overpassSelector } from '../features/data';
import type { DirectionsPlatform } from '../features/directions';
import { directionsPlatformOf } from '../features/directions';
import type { BeelineLayer, UserLocationLayer } from '../features/location';
import {
	createBeelineLayer,
	createFollowController,
	createLocationTracker,
	createUserLocationLayer,
	loadLastKnownPosition,
	saveLastKnownPosition,
} from '../features/location';
import { createMarkerRenderer } from '../features/markers';
import { toTileBounds } from '../features/navigation/bounds';
import { createUserInteractionSource } from '../features/navigation/user-interaction';
import { createOneHandZoomHandler } from '../features/zoom-gesture';
import drinkingWater from '../oql/drinking_water.overpassql?raw';
import publicToilets from '../oql/public_toilets.overpassql?raw';
import viewpoints from '../oql/viewpoints.overpassql?raw';
import { createDetailSheet } from '../ui/detail-sheet';
import { initInstallPrompt } from '../ui/install-prompt';
import type { LayerPicker } from '../ui/layer-picker';
import { createLayerPicker } from '../ui/layer-picker';
import type { LocateControl } from '../ui/locate-control';
import { createLocateControl } from '../ui/locate-control';
import { createGuidanceHud } from '../ui/guidance-hud';
import { createProvenanceIndicator } from '../ui/provenance-indicator';
import { dismissSplash } from '../ui/splash';
import { isCoarsePointer } from '../ui/pointer';
import * as logger from '../utils/logger';
import type { GuidanceRuntime } from './guidance';
import { createGuidanceRuntime, initialGuidanceAppState } from './guidance';
import type { LayerKind } from './layers';
import {
	activeLayerCount,
	createFacilityLayers,
	disableLayer,
	enableLayer,
	LAYER_KINDS,
} from './layers';
import { locateButtonViewOf, onceSettled, onLocateActivate } from './locate';
import {
	INITIALIZATION_FAILED_MESSAGE,
	INITIALIZATION_REFRESH_ACTION_LABEL,
	LOCATION_FALLBACK_MESSAGE,
	OFFLINE_STATUS_MESSAGE,
} from './messages';
import type { InstalledNoticeCenter, NoticeCenter } from './notices';
import { installNoticeCenter } from './notices';
import { registerServiceWorker } from './service-worker-client';
import type { SyncRuntime } from './sync';
import { createSyncRuntime, initialSyncState } from './sync';

export const MAP_CONTAINER_ID = 'map';

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
	doubleClickZoom: !input.coarsePointer,
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

type Teardown = () => void;

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

const zoomAnimationTracker = (map: L.Map): { readonly whenSettled: (fn: Teardown) => void } => {
	let zoomAnimating = false;
	map.on('zoomanim', () => {
		zoomAnimating = true;
	});
	map.on('zoomend', () => {
		zoomAnimating = false;
	});
	return {
		whenSettled: (fn) => {
			if (zoomAnimating) {
				map.once('zoomend', fn);
				return;
			}
			fn();
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
	const zoomTracker = zoomAnimationTracker(map);
	onTeardown(() => zoomTracker.whenSettled(() => map.remove()));
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
		viewpoint: overpassSelector(viewpoints),
	});

	const userLayer: UserLocationLayer = createUserLocationLayer(map);
	const beelineLayer: BeelineLayer = createBeelineLayer(map);
	if (remembered !== null) {
		userLayer.show(remembered, 'stale');
	}

	const platform: DirectionsPlatform = directionsPlatformOf(navigator.userAgent);

	const hud = createGuidanceHud(map, {
		onActivate: () => {
			followController.unfollow();
			guidanceRuntime.dispatch({ kind: 'target-revealed' });
		},
		onDismiss: () => guidanceRuntime.dispatch({ kind: 'guidance-dismissed' }),
	});

	const sheet = createDetailSheet(map, {
		onClose: () => guidanceRuntime.dispatch({ kind: 'sheet-closed' }),
		onDirections: (detail) => trackNavigationStarted(detail.kind),
	});
	onTeardown(sheet.destroy);

	const markerRenderer = createMarkerRenderer(
		{ water: layers.water.group, toilet: layers.toilet.group, viewpoint: layers.viewpoint.group },
		{ onSelect: (item) => guidanceRuntime.dispatch({ kind: 'facility-selected', item }) }
	);
	onTeardown(markerRenderer.destroy);

	const reportNearest = (kind: LayerKind, nearest: Located<Facility> | null): void => {
		if (kind === 'water') {
			guidanceRuntime.dispatch({ kind: 'nearest-water-changed', nearest });
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

	const runtime: SyncRuntime = createSyncRuntime(
		{
			now: timestampNow,
			queryFor: (kinds) => composeQuery(kinds.map((kind) => layers[kind].selector)),
			fetchFacilities,
			render: markerRenderer.render,
			clearRender: markerRenderer.clearAll,
			notify: notices.announce,
			clearStatus: notices.clearStatus,
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

	const guidanceRuntime: GuidanceRuntime = createGuidanceRuntime(
		{
			platform,
			renderHud: hud.render,
			renderSheet: sheet.render,
			showBeeline: beelineLayer.show,
			clearBeeline: beelineLayer.clear,
			selectMarker: markerRenderer.select,
			trackGuidanceStarted,
			originMoved: (position) => dispatchWhileMounted({ kind: 'origin-moved', position }),
			flyTo: ({ lat, lon }) => map.flyTo([lat, lon], Math.max(map.getZoom(), LOCATE_ZOOM)),
		},
		initialGuidanceAppState
	);

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
		userLayer.show(position, state.freshness);
		saveLastKnownPosition(localStorage, position);
		guidanceRuntime.dispatch({ kind: 'position-updated', position });
	});

	tracker.start();

	const layerActiveState = (): Readonly<Record<LayerKind, boolean>> => ({
		water: layers.water.active,
		toilet: layers.toilet.active,
		viewpoint: layers.viewpoint.active,
	});

	const layerPicker: LayerPicker = createLayerPicker({
		layers: LAYER_KINDS.map((kind) => ({ kind, label: layers[kind].label })),
		onToggle: (kind, active) => {
			const layer = layers[kind];
			if (active) {
				enableLayer(layer, map);
				trackLayerEnabled(layer.label, activeLayerCount(layers));
				dispatchWhileMounted({ kind: 'layer-toggled', layer: kind, active: true });
			} else {
				disableLayer(layer, map);
				markerRenderer.clear(kind);
				trackLayerDisabled(layer.label, activeLayerCount(layers));
				dispatchWhileMounted({ kind: 'layer-toggled', layer: kind, active: false });
			}
			guidanceRuntime.dispatch({ kind: 'layer-toggled', layer: kind, active });
			layerPicker.render(layerActiveState());
		},
	});
	layerPicker.control.addTo(map);

	enableLayer(layers.water, map);
	layerPicker.render(layerActiveState());

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	const cancelPendingViewportDispatch = (): void => {
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
	};
	const onMoveEnd = (): void => {
		cancelPendingViewportDispatch();
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			dispatchWhileMounted({ kind: 'viewport-settled', viewport: viewportOf(map) });
		}, VIEWPORT_DEBOUNCE_MS);
	};
	map.on('movestart', cancelPendingViewportDispatch);
	map.on('dragstart', cancelPendingViewportDispatch);
	map.on('moveend', onMoveEnd);
	const stopViewportTracking = (): void => {
		map.off('moveend', onMoveEnd);
		cancelPendingViewportDispatch();
	};
	onTeardown(stopViewportTracking);

	dispatchWhileMounted({ kind: 'viewport-settled', viewport: viewportOf(map) });

	logger.info('App initialization complete');
};

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
