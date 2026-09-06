import type * as L from 'leaflet';
import { trackAreaExplored, trackEmptyArea } from '../analytics';
import { FETCH_PADDING_FACTOR, MIN_FETCH_ZOOM } from '../core/config';
import type { Facility, LatLon, Located, TileId, Timestamp } from '../domain';
import { boundsOfTiles, formatDistance, nearestOf, tilesCovering, timestampNow } from '../domain';
import type { FacilityCache, Lookup } from '../features/cache';
import { padBounds, toLatLngBounds, toTileBounds } from '../features/navigation/bounds';
import { withLoading } from '../ui/loading';
import type { NotificationType } from '../ui/notifications';
import { showNotification } from '../ui/notifications';
import * as logger from '../utils/logger';
import type {
	FacilityLayer,
	FacilityLayers,
	FailureNotification,
	LayerKind,
	LayerRefresh,
	RefreshDeps,
	RefreshOutcome,
	RefreshResult,
} from './layers';
import {
	abortSharedViewportRequest,
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
import type { Origin, Session } from './session';
import {
	canNotifyEmptyArea,
	resolveOrigin,
	withEmptyAreaNotified,
	withZoomedOutNotice,
} from './session';

export type App = {
	readonly layers: FacilityLayers;
	readonly session: Session;
	readonly cache: FacilityCache;
};

export type Viewport = {
	readonly bounds: L.LatLngBounds;
	readonly zoom: number;
	readonly center: LatLon;
};

export const viewportOf = (map: L.Map, boundsOverride?: L.LatLngBounds): Viewport => {
	const center = map.getCenter();
	return {
		bounds: boundsOverride ?? map.getBounds(),
		zoom: map.getZoom(),
		center: { lat: center.lat, lon: center.lng },
	};
};

export const canFetchAtZoom = (zoom: number): boolean => zoom >= MIN_FETCH_ZOOM;

export type ExploreDeps = {
	readonly refresh: RefreshDeps;
	readonly notify: (message: string, type: NotificationType, duration: number) => void;
	readonly now: () => Timestamp;
	readonly trackAreaExplored: () => void;
	readonly trackEmptyArea: (kind: LayerKind) => void;
	readonly reportNearest: (kind: LayerKind, nearest: Located<Facility> | null) => void;
};

const noopReportNearest = (): void => undefined;

export const defaultExploreDeps: ExploreDeps = {
	refresh: defaultRefreshDeps,
	notify: showNotification,
	now: timestampNow,
	trackAreaExplored,
	trackEmptyArea,
	reportNearest: noopReportNearest,
};

const showZoomedOutNoticeOnce = (app: App, deps: ExploreDeps): void => {
	if (app.session.get().zoomedOutNoticeShown) {
		return;
	}
	deps.notify(ZOOMED_OUT_MESSAGE, 'info', 5000);
	app.session.update((state) => withZoomedOutNotice(state, true));
};

const passZoomGuard = (app: App, viewport: Viewport, deps: ExploreDeps): boolean => {
	if (canFetchAtZoom(viewport.zoom)) {
		app.session.update((state) => withZoomedOutNotice(state, false));
		return true;
	}

	abortSharedViewportRequest(app.layers);
	for (const kind of LAYER_KINDS) {
		clearLayerMarkers(app.layers[kind]);
	}
	showZoomedOutNoticeOnce(app, deps);
	return false;
};

const handleOutcome = (
	app: App,
	layer: FacilityLayer,
	outcome: RefreshOutcome,
	deps: ExploreDeps,
	shouldNotifyFailure: boolean
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
			deps.reportNearest(layer.kind, nearest);
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
			deps.reportNearest(layer.kind, null);
			return;
		}
		case 'superseded':
			return;
		case 'failed': {
			if (shouldNotifyFailure) {
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

const shouldNotifyFailureFor = (notification: FailureNotification, kind: LayerKind): boolean => {
	switch (notification.kind) {
		case 'none':
			return false;
		case 'all':
			return true;
		case 'only':
			return notification.layer === kind;
		default: {
			const exhaustive: never = notification;
			throw new Error(`Unhandled failure notification: ${JSON.stringify(exhaustive)}`);
		}
	}
};

const reportOutcomes = (
	app: App,
	refreshes: readonly LayerRefresh[],
	deps: ExploreDeps,
	notification: FailureNotification
): void => {
	for (const refresh of refreshes) {
		handleOutcome(
			app,
			app.layers[refresh.kind],
			refresh.outcome,
			deps,
			shouldNotifyFailureFor(notification, refresh.kind)
		);
	}
};

const tilesCoveringPaddedViewport = (bounds: L.LatLngBounds): readonly TileId[] => {
	const loadBounds = padBounds(bounds, FETCH_PADDING_FACTOR);
	return tilesCovering(toTileBounds(loadBounds));
};

export type CachePreview =
	| { readonly kind: 'nothing-known' }
	| { readonly kind: 'rendered'; readonly outcomes: readonly LayerRefresh[] };

const previewFromCache = (
	app: App,
	targets: readonly FacilityLayer[],
	tiles: readonly TileId[],
	targetKinds: readonly LayerKind[],
	origin: Origin,
	deps: ExploreDeps,
	now: Timestamp
): { readonly lookup: Lookup; readonly preview: CachePreview } => {
	const lookup = app.cache.lookup(tiles, targetKinds, now);
	const preview: CachePreview =
		lookup.known.length > 0
			? {
					kind: 'rendered',
					outcomes: renderCached(targets, lookup.facilities, origin, deps.refresh),
				}
			: { kind: 'nothing-known' };
	return { lookup, preview };
};

export const rerankFromCache = (
	app: App,
	viewport: Viewport,
	deps: ExploreDeps = defaultExploreDeps
): void => {
	const origin = resolveOrigin(app.session.get(), viewport.center);
	const targets = activeLayers(app.layers);
	if (targets.length === 0) {
		return;
	}
	const targetKinds = targets.map((layer) => layer.kind);
	const tiles = tilesCoveringPaddedViewport(viewport.bounds);
	const now = deps.now();
	const { preview } = previewFromCache(app, targets, tiles, targetKinds, origin, deps, now);
	if (preview.kind === 'rendered') {
		reportOutcomes(app, preview.outcomes, deps, { kind: 'none' });
	}
};

const absorbFetchedAndRenderCacheUnion = (
	app: App,
	targets: readonly FacilityLayer[],
	tiles: readonly TileId[],
	targetKinds: readonly LayerKind[],
	origin: Origin,
	deps: ExploreDeps,
	now: Timestamp,
	fetchedTiles: readonly TileId[],
	fetchedFacilities: readonly Facility[]
): readonly LayerRefresh[] => {
	app.cache.absorb(fetchedTiles, targetKinds, fetchedFacilities, now);
	const updated = app.cache.lookup(tiles, targetKinds, now);
	return renderCached(targets, updated.facilities, origin, deps.refresh);
};

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
	if (targets.length === 0) {
		return;
	}
	const targetKinds = targets.map((layer) => layer.kind);
	const tiles = tilesCoveringPaddedViewport(viewport.bounds);
	const now = deps.now();

	const { lookup, preview } = previewFromCache(app, targets, tiles, targetKinds, origin, deps, now);
	const renderedFromCache = preview.kind === 'rendered';

	if (lookup.toFetch.length === 0) {
		switch (preview.kind) {
			case 'rendered':
				reportOutcomes(app, preview.outcomes, deps, { kind: 'all' });
				return;
			case 'nothing-known':
				return;
			default: {
				const exhaustive: never = preview;
				throw new Error(`Unhandled cache preview: ${JSON.stringify(exhaustive)}`);
			}
		}
	}

	const fetchTileBounds = boundsOfTiles(lookup.toFetch);
	if (fetchTileBounds === null) {
		return;
	}
	const fetchBounds = toLatLngBounds(fetchTileBounds);

	const fetchOutstandingTiles = (): Promise<RefreshResult> =>
		refreshLayers(app.layers, targets, fetchBounds, origin, deps.refresh, { rendering: 'defer' });
	const result = renderedFromCache
		? await fetchOutstandingTiles()
		: await withLoading(fetchOutstandingTiles);

	switch (result.kind) {
		case 'nothing-to-refresh':
		case 'superseded':
			return;
		case 'fetched': {
			const shown = absorbFetchedAndRenderCacheUnion(
				app,
				targets,
				tiles,
				targetKinds,
				resolveOrigin(app.session.get(), viewport.center),
				deps,
				now,
				lookup.toFetch,
				result.facilities
			);
			reportOutcomes(app, shown, deps, { kind: 'none' });
			return;
		}
		case 'failed': {
			const failedRefreshes: readonly LayerRefresh[] = result.kinds.map((kind) => ({
				kind,
				outcome: { kind: 'failed', error: result.error },
			}));
			if (renderedFromCache) {
				deps.notify(OFFLINE_SHOWING_SAVED_MESSAGE, 'info', 5000);
				reportOutcomes(app, failedRefreshes, deps, { kind: 'none' });
				return;
			}
			const [firstFailedKind] = result.kinds;
			reportOutcomes(
				app,
				failedRefreshes,
				deps,
				firstFailedKind === undefined ? { kind: 'none' } : { kind: 'only', layer: firstFailedKind }
			);
			return;
		}
		default: {
			const exhaustive: never = result;
			throw new Error(`Unhandled refresh result: ${JSON.stringify(exhaustive)}`);
		}
	}
}
