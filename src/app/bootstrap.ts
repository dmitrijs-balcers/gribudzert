import * as L from 'leaflet';
import { trackLayerDisabled, trackLayerEnabled, trackMapLoaded } from '../analytics';
import { DEFAULT_ZOOM, MAX_ZOOM, OSM_ATTRIBUTION, OSM_TILE_URL, RIGA_CENTER } from '../core/config';
import type { LatLon } from '../domain';
import { createFacilityCache, defaultSnapshotStore } from '../features/cache';
import type { UserPosition } from '../features/location/geolocation';
import {
	createUserLocationLayer,
	detectInitialLocation,
	locateUser,
	showUserLocation,
	toUserPosition,
} from '../features/location/geolocation';
import { overpassSelector } from '../features/data';
import { setupMapNavigationHandlers } from '../features/navigation/navigation';
import drinkingWater from '../oql/drinking_water.overpassql?raw';
import publicToilets from '../oql/public_toilets.overpassql?raw';
import { isOk } from '../types/result';
import { resetLoading, withLoading } from '../ui/loading';
import { createLocateControl } from '../ui/locate-control';
import { showNotification } from '../ui/notifications';
import * as logger from '../utils/logger';
import type { App } from './explore';
import { exploreViewport, viewportOf } from './explore';
import type { FacilityLayers, LayerKind } from './layers';
import {
	activeLayerCount,
	createFacilityLayers,
	disableLayer,
	enableLayer,
	layerKindOf,
} from './layers';
import { INITIALIZATION_FAILED_MESSAGE, LOCATION_FALLBACK_MESSAGE } from './messages';
import { createSession, initialState, withUserLocation } from './session';

export const MAP_CONTAINER_ID = 'map';

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

const detectStartPosition = async (): Promise<UserPosition | null> => {
	const detected = await withLoading(detectInitialLocation);
	if (isOk(detected)) {
		const position = toUserPosition(detected.value);
		logger.info('Location detected:', position.lat, position.lon);
		return position;
	}
	logger.warn('Location detection failed:', detected.error.message);
	showNotification(LOCATION_FALLBACK_MESSAGE, 'info', 5000);
	return null;
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
};

const exploreSafely = (app: App, map: L.Map, options: ExploreSafelyOptions = {}): void => {
	exploreViewport(app, viewportOf(map, options.bounds), undefined, options.kinds).catch(
		(error: unknown) => {
			logger.error('Failed to refresh facilities:', error instanceof Error ? error.message : error);
		}
	);
};

const handleLayerEnabledFromControl = (app: App, map: L.Map, event: L.LayersControlEvent): void => {
	const kind = layerKindOf(event.name);
	if (kind === null) {
		return;
	}
	const layer = app.layers[kind];
	enableLayer(layer, map);
	trackLayerEnabled(layer.label, activeLayerCount(app.layers));
	exploreSafely(app, map, { kinds: [kind] });
};

const handleLayerDisabledFromControl = (
	app: App,
	map: L.Map,
	event: L.LayersControlEvent
): void => {
	const kind = layerKindOf(event.name);
	if (kind === null) {
		return;
	}
	const layer = app.layers[kind];
	disableLayer(layer, map);
	trackLayerDisabled(layer.label, activeLayerCount(app.layers));
};

const wireLayerControl = (app: App, map: L.Map): void => {
	map.on('overlayadd', (event: L.LayersControlEvent) =>
		handleLayerEnabledFromControl(app, map, event)
	);
	map.on('overlayremove', (event: L.LayersControlEvent) =>
		handleLayerDisabledFromControl(app, map, event)
	);
};

const bootstrapOrThrow = async (): Promise<void> => {
	const startPosition = await detectStartPosition();
	trackMapLoaded(startPosition === null ? 'default' : 'user');

	const center: L.LatLngTuple =
		startPosition === null ? RIGA_CENTER : [startPosition.lat, startPosition.lon];
	const map = createMap(center);

	const userLayer = createUserLocationLayer(map);
	if (startPosition !== null) {
		showUserLocation(userLayer, startPosition);
	}

	const userLocation: LatLon | null =
		startPosition === null ? null : { lat: startPosition.lat, lon: startPosition.lon };
	const app: App = {
		layers: createFacilityLayers({
			water: overpassSelector(drinkingWater),
			toilet: overpassSelector(publicToilets),
		}),
		session: createSession(initialState(userLocation)),
		cache: createFacilityCache(defaultSnapshotStore()),
	};
	await awaitCacheReadyOrTimeout(app.cache.ready);

	enableLayer(app.layers.water, map);
	addLayerControl(map, app.layers);
	wireLayerControl(app, map);

	createLocateControl(() => {
		locateUser(map, userLayer)
			.then((result) => {
				if (isOk(result)) {
					app.session.update((state) => withUserLocation(state, result.value));
					exploreSafely(app, map);
				}
			})
			.catch((error: unknown) => {
				logger.error('Locate failed unexpectedly:', error instanceof Error ? error.message : error);
			});
	}).addTo(map);

	exploreSafely(app, map);
	setupMapNavigationHandlers(map, (bounds) => exploreSafely(app, map, { bounds }), {
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
