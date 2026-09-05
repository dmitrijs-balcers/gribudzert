/**
 * Application bootstrap
 * Creates the map, wires controls and events to the application layer, and kicks off
 * the first exploration. This is the only module that talks to every other layer.
 */

import * as L from 'leaflet';
import { trackLayerDisabled, trackLayerEnabled, trackMapLoaded } from '../analytics';
import { DEFAULT_ZOOM, MAX_ZOOM, OSM_ATTRIBUTION, OSM_TILE_URL, RIGA_CENTER } from '../core/config';
import type { LatLon } from '../domain';
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

/**
 * DOM id of the map container
 */
export const MAP_CONTAINER_ID = 'map';

/**
 * Detect the viewer's position before the map exists, so the map can open on it
 */
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

/**
 * Create the map with its base tiles and scale control
 */
const createMap = (center: L.LatLngTuple): L.Map => {
	const map = L.map(MAP_CONTAINER_ID, { center, zoom: DEFAULT_ZOOM, zoomControl: true });
	L.tileLayer(OSM_TILE_URL, { maxZoom: MAX_ZOOM, attribution: OSM_ATTRIBUTION }).addTo(map);
	L.control.scale({ metric: true, imperial: false }).addTo(map);
	return map;
};

/**
 * Add the layer control listing every facility layer under its label
 */
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

/**
 * Explore the current viewport, never letting a rejection escape into the event loop
 */
const exploreSafely = (
	app: App,
	map: L.Map,
	options: { readonly bounds?: L.LatLngBounds; readonly kinds?: readonly LayerKind[] } = {}
): void => {
	exploreViewport(app, viewportOf(map, options.bounds), undefined, options.kinds).catch(
		(error: unknown) => {
			logger.error('Failed to refresh facilities:', error instanceof Error ? error.message : error);
		}
	);
};

/**
 * Keep the layer aggregates in sync with the layer control
 */
const wireLayerControl = (app: App, map: L.Map): void => {
	map.on('overlayadd', (event: L.LayersControlEvent) => {
		const kind = layerKindOf(event.name);
		if (kind === null) {
			return;
		}
		const layer = app.layers[kind];
		enableLayer(layer, map);
		trackLayerEnabled(layer.label, activeLayerCount(app.layers));
		exploreSafely(app, map, { kinds: [kind] });
	});

	map.on('overlayremove', (event: L.LayersControlEvent) => {
		const kind = layerKindOf(event.name);
		if (kind === null) {
			return;
		}
		const layer = app.layers[kind];
		disableLayer(layer, map);
		trackLayerDisabled(layer.label, activeLayerCount(app.layers));
	});
};

/**
 * Build the map and wire everything together
 */
const start = async (): Promise<void> => {
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
	};

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

/**
 * Initialise the application. Never rejects: failures are reported to the user and logged.
 */
export async function bootstrap(): Promise<void> {
	try {
		await start();
	} catch (error) {
		resetLoading();
		showNotification(INITIALIZATION_FAILED_MESSAGE, 'error', 0);
		logger.error('App initialization error:', error instanceof Error ? error.message : error);
	}
}
