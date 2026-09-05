/**
 * Viewport exploration
 * Refreshing the active facility layers for the visible area, with the zoom guard,
 * notifications and analytics that go with it.
 */

import type * as L from 'leaflet';
import { trackAreaExplored, trackEmptyArea } from '../analytics';
import { MIN_FETCH_ZOOM } from '../core/config';
import type { LatLon } from '../domain';
import { formatDistance, nearestOf } from '../domain';
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
} from './layers';
import {
	activeLayers,
	clearLayerMarkers,
	defaultRefreshDeps,
	LAYER_KINDS,
	refreshLayer,
} from './layers';
import { emptyAreaMessage, fetchErrorMessage, ZOOMED_OUT_MESSAGE } from './messages';
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
 * Apply the zoom guard: below MIN_FETCH_ZOOM every layer is emptied and the viewer is told
 * to zoom in, once per zoomed-out stretch.
 * @returns true when fetching may proceed
 */
const passZoomGuard = (app: App, viewport: Viewport, deps: ExploreDeps): boolean => {
	if (canFetchAtZoom(viewport.zoom)) {
		app.session.update((state) => withZoomedOutNotice(state, false));
		return true;
	}

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
 */
const handleOutcome = (
	app: App,
	layer: FacilityLayer,
	outcome: RefreshOutcome,
	deps: ExploreDeps
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
			deps.notify(fetchErrorMessage(layer.kind, outcome.error), 'error', 5000);
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
 * Refresh facility layers for the visible area.
 * @param app - Layers and session
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
	const targets = activeLayers(app.layers).filter((layer) => kinds.includes(layer.kind));

	await Promise.all(
		targets.map(async (layer) => {
			const outcome = await withLoading(() =>
				refreshLayer(layer, viewport.bounds, origin, deps.refresh)
			);
			handleOutcome(app, layer, outcome, deps);
		})
	);
}
