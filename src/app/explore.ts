/**
 * Viewport exploration
 * Refreshing the active facility layers for the visible area, with the zoom guard,
 * notifications and analytics that go with it.
 */

import type * as L from 'leaflet';
import { trackAreaExplored, trackEmptyArea } from '../analytics';
import { FETCH_PADDING_FACTOR, MIN_FETCH_ZOOM } from '../core/config';
import type { LatLon } from '../domain';
import { boundsOfTiles, formatDistance, nearestOf, tilesCovering } from '../domain';
import type { FacilityCache } from '../features/cache';
import { padBounds, toLatLngBounds, toTileBounds } from '../features/navigation/bounds';
import { withLoading } from '../ui/loading';
import type { NotificationType } from '../ui/notifications';
import { showNotification } from '../ui/notifications';
import * as logger from '../utils/logger';
import type {
	FacilityLayer,
	FacilityLayers,
	LayerKind,
	RefreshDeps,
	RefreshOutcome,
	RefreshResult,
} from './layers';
import {
	abortInflight,
	activeLayers,
	clearLayerMarkers,
	defaultRefreshDeps,
	LAYER_KINDS,
	refreshLayers,
	renderCached,
} from './layers';
import {
	emptyAreaMessage,
	fetchErrorMessage,
	OFFLINE_SHOWING_SAVED_MESSAGE,
	ZOOMED_OUT_MESSAGE,
} from './messages';
import type { Session } from './session';
import {
	canNotifyEmptyArea,
	resolveOrigin,
	withEmptyAreaNotified,
	withZoomedOutNotice,
} from './session';

/**
 * What exploration needs from the application
 */
export type App = {
	readonly layers: FacilityLayers;
	readonly session: Session;
	/** Offline facility cache: what a viewport already needs no network fetch for */
	readonly cache: FacilityCache;
};

/**
 * Snapshot of the visible map area
 */
export type Viewport = {
	readonly bounds: L.LatLngBounds;
	readonly zoom: number;
	readonly center: LatLon;
};

/**
 * Snapshot the map's current view
 * @param map - Leaflet map
 * @param bounds - Bounds to use instead of `map.getBounds()` (e.g. from a moveend handler)
 */
export const viewportOf = (map: L.Map, bounds?: L.LatLngBounds): Viewport => {
	const center = map.getCenter();
	return {
		bounds: bounds ?? map.getBounds(),
		zoom: map.getZoom(),
		center: { lat: center.lat, lon: center.lng },
	};
};

/**
 * Whether the map is zoomed in far enough for facility queries
 */
export const canFetchAtZoom = (zoom: number): boolean => zoom >= MIN_FETCH_ZOOM;

/**
 * Collaborators of `exploreViewport`, injectable for tests
 */
export type ExploreDeps = {
	readonly refresh: RefreshDeps;
	readonly notify: (message: string, type: NotificationType, duration: number) => void;
	readonly now: () => number;
	readonly trackAreaExplored: () => void;
	readonly trackEmptyArea: (kind: LayerKind) => void;
};

/**
 * Production collaborators
 */
export const defaultExploreDeps: ExploreDeps = {
	refresh: defaultRefreshDeps,
	notify: showNotification,
	now: () => Date.now(),
	trackAreaExplored,
	trackEmptyArea,
};

/**
 * Apply the zoom guard: below MIN_FETCH_ZOOM every layer is emptied, the shared in-flight
 * request (if any) is cancelled, and the viewer is told to zoom in, once per zoomed-out
 * stretch.
 * @returns true when fetching may proceed
 */
const passZoomGuard = (app: App, viewport: Viewport, deps: ExploreDeps): boolean => {
	if (canFetchAtZoom(viewport.zoom)) {
		app.session.update((state) => withZoomedOutNotice(state, false));
		return true;
	}

	abortInflight(app.layers);
	for (const kind of LAYER_KINDS) {
		clearLayerMarkers(app.layers[kind]);
	}
	if (!app.session.get().zoomedOutNoticeShown) {
		deps.notify(ZOOMED_OUT_MESSAGE, 'info', 5000);
		app.session.update((state) => withZoomedOutNotice(state, true));
	}
	return false;
};

/**
 * React to the outcome of one layer refresh
 * @param notifyFailure - Whether a failure should reach the viewer. Every layer in a refresh
 * shares one Overpass request, so one failure is announced once, not once per layer.
 */
const handleOutcome = (
	app: App,
	layer: FacilityLayer,
	outcome: RefreshOutcome,
	deps: ExploreDeps,
	notifyFailure: boolean
): void => {
	switch (outcome.kind) {
		case 'loaded': {
			deps.trackAreaExplored();
			const nearest = nearestOf(outcome.items);
			if (nearest !== null) {
				logger.info(
					`Nearest ${layer.kind}: ${nearest.facility.id} (${formatDistance(nearest.distance)} away)`
				);
			}
			logger.info(`Loaded ${outcome.items.length} ${layer.kind} facilities`);
			return;
		}
		case 'empty': {
			deps.trackEmptyArea(layer.kind);
			logger.warn(`No ${layer.kind} facilities returned for current bounds`);
			const now = deps.now();
			if (canNotifyEmptyArea(app.session.get(), layer.kind, now)) {
				deps.notify(emptyAreaMessage(layer.kind), 'info', 5000);
				app.session.update((state) => withEmptyAreaNotified(state, layer.kind, now));
			}
			return;
		}
		case 'superseded':
			return;
		case 'failed': {
			if (notifyFailure) {
				deps.notify(fetchErrorMessage(layer.kind, outcome.error), 'error', 5000);
			}
			logger.error(`Failed to fetch ${layer.kind} facilities:`, outcome.error);
			return;
		}
		default: {
			const exhaustive: never = outcome;
			throw new Error(`Unhandled refresh outcome: ${JSON.stringify(exhaustive)}`);
		}
	}
};

/**
 * Refresh facility layers for the visible area, the offline cache first. Every tile the
 * padded viewport covers is looked up in `app.cache` for the target kinds (the kinds of
 * whichever layers this call targets, `targets.map(l => l.kind)`): anything already known
 * there (fresh or stale, for at least one target kind) is rendered immediately from memory,
 * before any network round trip, and only the tiles where a target kind is stale or missing
 * are actually fetched - over a single Overpass request (see `refreshLayers`) that always asks
 * for every target kind in the fetched tiles, so a kind that happened to be fresh there simply
 * gets refreshed too. Coverage is tracked per facility kind, so this one flow handles every
 * call the same way, whether it refreshes every active layer for a viewport change or just the
 * layer that was just switched on in the layer control (see `wireLayerControl` in
 * bootstrap.ts) - a narrower `kinds` never needs to bypass the cache. A cache render alone
 * produces no notifications or analytics: it is a fast preview, superseded by the real outcome
 * once the fetch (if any) completes. When nothing needs fetching, the cache render *is* the
 * final outcome, so it is routed through `handleOutcome` like a network result would be -
 * otherwise an already-fully-fetched, truly empty area would never tell the viewer so.
 * @param app - Layers, session and offline cache
 * @param viewport - Visible area to explore
 * @param deps - Collaborators (default: production)
 * @param kinds - Layers to refresh; inactive ones are skipped (default: every active layer)
 */
export async function exploreViewport(
	app: App,
	viewport: Viewport,
	deps: ExploreDeps = defaultExploreDeps,
	kinds: readonly LayerKind[] = LAYER_KINDS
): Promise<void> {
	if (!passZoomGuard(app, viewport, deps)) {
		return;
	}

	const origin = resolveOrigin(app.session.get(), viewport.center);
	const active = activeLayers(app.layers);
	const targets = active.filter((layer) => kinds.includes(layer.kind));
	if (targets.length === 0) {
		return;
	}
	const targetKinds = targets.map((layer) => layer.kind);

	// Fetch a larger area than what's visible so panning and zooming within it can reuse
	// this data instead of hitting Overpass's rate limit again.
	const loadBounds = padBounds(viewport.bounds, FETCH_PADDING_FACTOR);
	const tiles = tilesCovering(toTileBounds(loadBounds));

	const now = deps.now();
	const found = app.cache.lookup(tiles, targetKinds, now);
	const renderedFromCache = found.known.length > 0;
	const cacheOutcomes = renderedFromCache
		? renderCached(targets, found.facilities, origin, deps.refresh)
		: null;

	if (found.toFetch.length === 0) {
		if (cacheOutcomes !== null) {
			for (const { kind, outcome } of cacheOutcomes) {
				handleOutcome(app, app.layers[kind], outcome, deps, true);
			}
		}
		return;
	}

	const fetchTileBounds = boundsOfTiles(found.toFetch);
	if (fetchTileBounds === null) {
		// found.toFetch is non-empty here, so boundsOfTiles never actually returns null; this
		// only satisfies its nullable return type.
		return;
	}
	const fetchBounds = toLatLngBounds(fetchTileBounds);

	const doFetch = (): Promise<RefreshResult> =>
		refreshLayers(app.layers, targets, fetchBounds, origin, deps.refresh, { skipRender: true });
	// The loading overlay is a full-screen blocking dim; skip it when the viewer is already
	// looking at saved points from the cache while the fetch fills in the rest.
	const result = renderedFromCache ? await doFetch() : await withLoading(doFetch);

	if (result.fetched !== null) {
		// `found.toFetch` is exactly the set of tiles this fetch covered.
		app.cache.absorb(found.toFetch, targetKinds, result.fetched, now);
		// refreshLayers only rendered the fetched strip's own outcomes; render the union of
		// cache and network for the full padded area instead of relying on that strip render.
		const updated = app.cache.lookup(tiles, targetKinds, now);
		const shown = renderCached(targets, updated.facilities, origin, deps.refresh);
		// Notify and track on what the viewer actually sees (the union), not on the strip
		// alone: a strip with nothing in it is not an empty area when saved points surround it.
		for (const { kind, outcome } of shown) {
			handleOutcome(app, app.layers[kind], outcome, deps, false);
		}
		return;
	}

	const failed = result.layers.some(({ outcome }) => outcome.kind === 'failed');
	if (!failed) {
		// Every outcome was superseded by a newer refresh - stay silent.
		return;
	}

	if (renderedFromCache) {
		// Offline (or Overpass is down): the viewer is already seeing saved points, so say
		// that instead of the usual error, but still log it.
		deps.notify(OFFLINE_SHOWING_SAVED_MESSAGE, 'info', 5000);
		for (const { kind, outcome } of result.layers) {
			handleOutcome(app, app.layers[kind], outcome, deps, false);
		}
		return;
	}

	const firstFailed = result.layers.find(({ outcome }) => outcome.kind === 'failed');
	for (const layerResult of result.layers) {
		handleOutcome(
			app,
			app.layers[layerResult.kind],
			layerResult.outcome,
			deps,
			layerResult === firstFailed
		);
	}
}
