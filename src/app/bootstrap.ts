import * as L from 'leaflet';
import {
	trackLayerDisabled,
	trackLayerEnabled,
	trackLocateFailed,
	trackLocateRequested,
	trackLocateSuccess,
	trackMapLoaded,
} from '../analytics';
import {
	DEFAULT_ZOOM,
	LOCATE_ZOOM,
	MAX_ZOOM,
	OSM_ATTRIBUTION,
	OSM_TILE_URL,
	RIGA_CENTER,
} from '../core/config';
import type { Facility, LatLon, Located, UserPosition, WaterFacility } from '../domain';
import {
	bearingBetween,
	compassPointOf,
	distanceBetween,
	isWaterFacility,
	timestampNow,
} from '../domain';
import { createFacilityCache, defaultSnapshotStore } from '../features/cache';
import { overpassSelector } from '../features/data';
import type {
	BeelineLayer,
	FollowController,
	LocationTracker,
	UserLocationLayer,
} from '../features/location';
import {
	clearBeeline,
	createBeelineLayer,
	createFollowController,
	createLocationTracker,
	createUserLocationLayer,
	loadLastKnownPosition,
	saveLastKnownPosition,
	showBeeline,
	showUserPosition,
} from '../features/location';
import type { TrackingState } from '../features/location/tracker';
import { setupMapNavigationHandlers } from '../features/navigation/navigation';
import drinkingWater from '../oql/drinking_water.overpassql?raw';
import publicToilets from '../oql/public_toilets.overpassql?raw';
import { toLocationFailureCategory } from '../types/errors';
import { resetLoading } from '../ui/loading';
import type { LocateButtonView, LocateControl } from '../ui/locate-control';
import { createLocateControl } from '../ui/locate-control';
import { createNearestHud } from '../ui/nearest-hud';
import { showNotification } from '../ui/notifications';
import * as logger from '../utils/logger';
import type { App, ExploreDeps } from './explore';
import { defaultExploreDeps, exploreViewport, rerankFromCache, viewportOf } from './explore';
import type { FacilityLayers, LayerKind } from './layers';
import {
	activeLayerCount,
	createFacilityLayers,
	disableLayer,
	enableLayer,
	layerKindOf,
} from './layers';
import {
	INITIALIZATION_FAILED_MESSAGE,
	locationErrorMessage,
	LOCATION_FALLBACK_MESSAGE,
} from './messages';
import type { FollowMode } from '../features/location/follow';
import {
	createSession,
	initialState,
	needsReranking,
	withFollowMode,
	withNearestWater,
	withPopupOpen,
	withPosition,
	withRankedFrom,
} from './session';

export const MAP_CONTAINER_ID = 'map';

const NEAREST_WATER_GLYPH = '🚰';

const CACHE_WARMUP_TIMEOUT_MS = 2000;

const awaitCacheReadyOrTimeout = async (ready: Promise<void>): Promise<void> => {
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

const createMap = (center: L.LatLngTuple): L.Map => {
	const map = L.map(MAP_CONTAINER_ID, { center, zoom: DEFAULT_ZOOM, zoomControl: true });
	L.tileLayer(OSM_TILE_URL, { maxZoom: MAX_ZOOM, attribution: OSM_ATTRIBUTION }).addTo(map);
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

type ExploreSafelyOptions = {
	readonly bounds?: L.LatLngBounds;
	readonly kinds?: readonly LayerKind[];
	readonly reportNearest?: ExploreDeps['reportNearest'];
};

const exploreSafely = (app: App, map: L.Map, options: ExploreSafelyOptions = {}): void => {
	const deps: ExploreDeps =
		options.reportNearest === undefined
			? defaultExploreDeps
			: { ...defaultExploreDeps, reportNearest: options.reportNearest };
	exploreViewport(app, viewportOf(map, options.bounds), deps, options.kinds).catch(
		(error: unknown) => {
			logger.error('Failed to refresh facilities:', error instanceof Error ? error.message : error);
		}
	);
};

const toLocatedWater = (item: Located<Facility>): Located<WaterFacility> | null =>
	isWaterFacility(item.facility)
		? { facility: item.facility, distance: item.distance, isNearest: item.isNearest }
		: null;

const findMarkerAt = (group: L.FeatureGroup<L.Marker>, coordinates: LatLon): L.Marker | null => {
	let found: L.Marker | null = null;
	group.eachLayer((layer) => {
		if (found !== null || !(layer instanceof L.Marker)) {
			return;
		}
		const latLng = layer.getLatLng();
		if (latLng.lat === coordinates.lat && latLng.lng === coordinates.lon) {
			found = layer;
		}
	});
	return found;
};

const flyToNearestWaterAndOpenPopup = (app: App, map: L.Map): void => {
	const nearest = app.session.get().nearestWater;
	if (nearest === null) {
		return;
	}
	const coordinates = nearest.facility.coordinates;
	map.flyTo([coordinates.lat, coordinates.lon], Math.max(map.getZoom(), LOCATE_ZOOM));
	findMarkerAt(app.layers.water.group, coordinates)?.openPopup();
};

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

const reportPressOutcome = (tracker: LocationTracker): void => {
	const stop = tracker.subscribe((state) => {
		if (state.kind === 'tracking') {
			stop();
			trackLocateSuccess();
		} else if (state.kind === 'failed') {
			stop();
			trackLocateFailed(toLocationFailureCategory(state.error));
			showNotification(locationErrorMessage(state.error), 'error', 5000);
		}
	});
};

const onLocateActivate = (tracker: LocationTracker, followController: FollowController): void => {
	trackLocateRequested();
	const state = tracker.state();
	switch (state.kind) {
		case 'idle':
		case 'failed':
			reportPressOutcome(tracker);
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

type LocationHandle = {
	readonly runExplore: (options?: ExploreSafelyOptions) => void;
	readonly onWaterLayerDisabled: () => void;
};

const wireLocation = (app: App, map: L.Map, remembered: UserPosition | null): LocationHandle => {
	const userLayer: UserLocationLayer = createUserLocationLayer(map);
	const beelineLayer: BeelineLayer = createBeelineLayer(map);
	if (remembered !== null) {
		showUserPosition(userLayer, remembered, 'stale');
	}

	const tracker = createLocationTracker();
	const hud = createNearestHud(map, () => {
		followController.unfollow();
		flyToNearestWaterAndOpenPopup(app, map);
	});

	const refreshHudAndBeeline = (position: UserPosition): void => {
		const nearest = app.session.get().nearestWater;
		if (nearest === null || !app.layers.water.active) {
			hud.render({ kind: 'hidden' });
			clearBeeline(beelineLayer);
			return;
		}
		const to = nearest.facility.coordinates;
		const bearing = bearingBetween(position, to);
		hud.render({
			kind: 'shown',
			distance: distanceBetween(position, to),
			bearing,
			glyph: NEAREST_WATER_GLYPH,
			label: compassPointOf(bearing),
		});
		showBeeline(beelineLayer, position, to);
	};

	const reportNearest = (kind: LayerKind, nearest: Located<Facility> | null): void => {
		if (kind !== 'water') {
			return;
		}
		const water = nearest === null ? null : toLocatedWater(nearest);
		app.session.update((state) => withNearestWater(state, water));
		const position = app.session.get().userLocation;
		if (position !== null) {
			refreshHudAndBeeline(position);
		}
	};

	const runExplore = (options: ExploreSafelyOptions = {}): void =>
		exploreSafely(app, map, { ...options, reportNearest });

	const rerank = (): void =>
		rerankFromCache(app, viewportOf(map), { ...defaultExploreDeps, reportNearest });

	const renderLocateButton = (): void => {
		locateControl.render(locateButtonViewOf(tracker.state(), followController.mode()));
	};

	const followController = createFollowController(map, tracker, (mode) => {
		app.session.update((state) => withFollowMode(state, mode));
		renderLocateButton();
	});

	const locateControl: LocateControl = createLocateControl(() =>
		onLocateActivate(tracker, followController)
	);
	locateControl.control.addTo(map);
	followController.follow('setView');

	let startupSettled = remembered !== null;
	if (startupSettled) {
		trackMapLoaded('user');
	}

	tracker.subscribe((state) => {
		renderLocateButton();

		if (!startupSettled && (state.kind === 'tracking' || state.kind === 'failed')) {
			startupSettled = true;
			trackMapLoaded(state.kind === 'tracking' ? 'user' : 'default');
			if (state.kind === 'failed') {
				showNotification(LOCATION_FALLBACK_MESSAGE, 'info', 5000);
			}
		}

		if (state.kind !== 'tracking') {
			return;
		}

		const position = state.position;
		showUserPosition(userLayer, position, state.freshness);
		saveLastKnownPosition(localStorage, position);
		app.session.update((current) => withPosition(current, position));
		refreshHudAndBeeline(position);

		if (needsReranking(app.session.get(), position)) {
			app.session.update((current) => withRankedFrom(current, position));
			rerank();
		}
	});

	map.on('popupopen', () => app.session.update((state) => withPopupOpen(state, true)));
	map.on('popupclose', () => {
		app.session.update((state) => withPopupOpen(state, false));
		const position = app.session.get().userLocation;
		if (position !== null && needsReranking(app.session.get(), position)) {
			app.session.update((current) => withRankedFrom(current, position));
			rerank();
		}
	});

	tracker.start();

	return {
		runExplore,
		onWaterLayerDisabled: () => {
			app.session.update((state) => withNearestWater(state, null));
			hud.render({ kind: 'hidden' });
			clearBeeline(beelineLayer);
		},
	};
};

const handleLayerEnabledFromControl = (
	app: App,
	map: L.Map,
	event: L.LayersControlEvent,
	location: LocationHandle
): void => {
	const kind = layerKindOf(event.name);
	if (kind === null) {
		return;
	}
	const layer = app.layers[kind];
	enableLayer(layer, map);
	trackLayerEnabled(layer.label, activeLayerCount(app.layers));
	location.runExplore({ kinds: [kind] });
};

const handleLayerDisabledFromControl = (
	app: App,
	map: L.Map,
	event: L.LayersControlEvent,
	location: LocationHandle
): void => {
	const kind = layerKindOf(event.name);
	if (kind === null) {
		return;
	}
	const layer = app.layers[kind];
	disableLayer(layer, map);
	trackLayerDisabled(layer.label, activeLayerCount(app.layers));
	if (kind === 'water') {
		location.onWaterLayerDisabled();
	}
};

const wireLayerControl = (app: App, map: L.Map, location: LocationHandle): void => {
	map.on('overlayadd', (event: L.LayersControlEvent) =>
		handleLayerEnabledFromControl(app, map, event, location)
	);
	map.on('overlayremove', (event: L.LayersControlEvent) =>
		handleLayerDisabledFromControl(app, map, event, location)
	);
};

const bootstrapOrThrow = async (): Promise<void> => {
	const remembered = loadLastKnownPosition(localStorage, timestampNow());

	const center: L.LatLngTuple =
		remembered === null ? RIGA_CENTER : [remembered.lat, remembered.lon];
	const map = createMap(center);

	const app: App = {
		layers: createFacilityLayers({
			water: overpassSelector(drinkingWater),
			toilet: overpassSelector(publicToilets),
		}),
		session: createSession(initialState(remembered)),
		cache: createFacilityCache(defaultSnapshotStore()),
	};
	await awaitCacheReadyOrTimeout(app.cache.ready);

	const location = wireLocation(app, map, remembered);

	enableLayer(app.layers.water, map);
	addLayerControl(map, app.layers);
	wireLayerControl(app, map, location);

	location.runExplore();
	setupMapNavigationHandlers(map, (bounds) => location.runExplore({ bounds }), {
		initialBounds: map.getBounds(),
	});

	logger.info('App initialization complete');
};

export async function bootstrap(): Promise<void> {
	try {
		await bootstrapOrThrow();
	} catch (error) {
		resetLoading();
		showNotification(INITIALIZATION_FAILED_MESSAGE, 'error', 0);
		logger.error('App initialization error:', error instanceof Error ? error.message : error);
	}
}
