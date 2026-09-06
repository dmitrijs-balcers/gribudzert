/**
 * Facility layers
 * A FacilityLayer is the aggregate for one kind of facility on the map: it owns the Leaflet
 * group holding the markers and the Overpass selector fragment that fills it. The single
 * request allowed to be in flight, however, is NOT tracked per layer: the public Overpass
 * API only grants 2 concurrent request slots per IP, so every active layer is refreshed by
 * one shared request per viewport (see `refreshLayers`), and its `AbortController` lives on
 * the `FacilityLayers` aggregate (`inflight`) rather than on any one layer. Starting a new
 * viewport refresh aborts the previous one regardless of which layers it served; disabling a
 * single layer never aborts it on the other layers' behalf; a superseded (or since-disabled)
 * layer's result is simply not applied to its markers.
 */

import * as L from 'leaflet';
import type { LayerName } from '../core/config';
import { LAYER_NAMES } from '../core/config';
import type { Facility, FacilityKind, Located } from '../domain';
import { markNearest, withDistances } from '../domain';
import type { OverpassSelector } from '../features/data';
import { composeQuery, fetchFacilities } from '../features/data';
import { addMarkers } from '../features/markers/markers';
import type { FetchError } from '../types/errors';
import type { Result } from '../types/result';
import { isErr } from '../types/result';
import type { Origin } from './session';

/**
 * Kinds of facility layers, one per facility kind
 */
export type LayerKind = FacilityKind;

/**
 * Every layer kind, in display order
 */
export const LAYER_KINDS: readonly LayerKind[] = ['water', 'toilet'];

/**
 * Leaflet group that can hold both circle markers and icon markers
 */
export type FacilityLayerGroup = L.FeatureGroup<L.CircleMarker | L.Marker>;

/**
 * Aggregate for one kind of facility on the map
 */
export type FacilityLayer = {
	readonly kind: LayerKind;
	/** Name shown in the layer control and reported to analytics */
	readonly label: LayerName;
	/** Overpass QL selector fragment for this kind, composed with the others by `refreshLayers` */
	readonly selector: OverpassSelector;
	readonly group: FacilityLayerGroup;
	/** Whether the layer is on the map and should follow viewport changes */
	active: boolean;
};

/**
 * All facility layers, keyed by kind, plus the controller for the single Overpass request
 * shared by whichever layers a viewport refresh is currently serving
 */
export type FacilityLayers = Readonly<Record<LayerKind, FacilityLayer>> & {
	inflight: AbortController | null;
};

/**
 * Layer-control label for a layer kind
 */
export const labelOf = (kind: LayerKind): LayerName => {
	switch (kind) {
		case 'water':
			return LAYER_NAMES.WATER;
		case 'toilet':
			return LAYER_NAMES.TOILET;
		default: {
			const exhaustive: never = kind;
			return exhaustive;
		}
	}
};

/**
 * Reverse lookup from layer-control label to kind; exhaustive over LAYER_NAMES
 */
const KIND_BY_LABEL: Readonly<Record<LayerName, LayerKind>> = {
	[LAYER_NAMES.WATER]: 'water',
	[LAYER_NAMES.TOILET]: 'toilet',
};

/**
 * Whether a layer-control event name is one of ours
 */
export const isLayerName = (name: string): name is LayerName => Object.hasOwn(KIND_BY_LABEL, name);

/**
 * Layer kind for a layer-control event name, or null for foreign layers
 */
export const layerKindOf = (name: string): LayerKind | null =>
	isLayerName(name) ? KIND_BY_LABEL[name] : null;

/**
 * Create an inactive, empty facility layer
 * @param kind - Facility kind
 * @param selector - Overpass QL selector fragment for this kind
 * @param group - Leaflet group to render into (default: a fresh feature group)
 */
export const createFacilityLayer = (
	kind: LayerKind,
	selector: OverpassSelector,
	group: FacilityLayerGroup = L.featureGroup()
): FacilityLayer => ({
	kind,
	label: labelOf(kind),
	selector,
	group,
	active: false,
});

/**
 * Create one layer per kind, sharing a single (initially idle) in-flight controller
 * @param selectors - Overpass QL selector fragment per kind
 */
export const createFacilityLayers = (
	selectors: Readonly<Record<LayerKind, OverpassSelector>>
): FacilityLayers => ({
	water: createFacilityLayer('water', selectors.water),
	toilet: createFacilityLayer('toilet', selectors.toilet),
	inflight: null,
});

/**
 * The part of a Leaflet map a layer needs to attach itself
 */
export type LayerHost = Pick<L.Map, 'addLayer' | 'removeLayer'>;

/**
 * Abort the viewport-level request in flight, if any. Cancels the load for every layer it
 * was serving, not just one - use this for viewport-wide events (a new refresh, the zoom
 * guard), never to react to a single layer being disabled.
 */
export const abortInflight = (layers: FacilityLayers): void => {
	if (layers.inflight !== null) {
		layers.inflight.abort();
		layers.inflight = null;
	}
};

/**
 * Drop a layer's own markers. Does not touch the shared in-flight request: other layers may
 * still need it, so nothing here cancels it - a result that arrives for a since-disabled
 * layer is simply not applied (see `refreshLayers`).
 */
export const clearLayerMarkers = (layer: FacilityLayer): void => {
	layer.group.clearLayers();
};

/**
 * Put the layer on the map and start following viewport changes
 */
export const enableLayer = (layer: FacilityLayer, host: LayerHost): void => {
	layer.active = true;
	host.addLayer(layer.group);
};

/**
 * Take the layer off the map and drop its markers. Any shared request still in flight keeps
 * running for the other layers it serves; this layer's own result, once it arrives, is
 * dropped rather than rendered because `active` is now false.
 */
export const disableLayer = (layer: FacilityLayer, host: LayerHost): void => {
	layer.active = false;
	clearLayerMarkers(layer);
	host.removeLayer(layer.group);
};

/**
 * Layers currently shown on the map
 */
export const activeLayers = (layers: FacilityLayers): readonly FacilityLayer[] =>
	LAYER_KINDS.map((kind) => layers[kind]).filter((layer) => layer.active);

/**
 * Number of layers currently shown on the map
 */
export const activeLayerCount = (layers: FacilityLayers): number => activeLayers(layers).length;

/**
 * Enrich facilities with distances from the origin. Water additionally gets its nearest
 * point flagged; toilets only carry distances.
 */
export const locateFacilities = (
	kind: LayerKind,
	facilities: readonly Facility[],
	origin: Origin
): readonly Located<Facility>[] => {
	const located = withDistances(facilities, origin.position);
	switch (kind) {
		case 'water':
			return markNearest(located);
		case 'toilet':
			return located;
		default: {
			const exhaustive: never = kind;
			return exhaustive;
		}
	}
};

/**
 * Fetch errors that reach the user; an abort is never one of them
 */
export type RefreshError = Exclude<FetchError, { readonly type: 'aborted' }>;

/**
 * Where a refresh outcome's facilities came from: the offline cache (shown immediately,
 * before or instead of a network round trip) or a live Overpass response
 */
export type RefreshSource = 'cache' | 'network';

/**
 * What happened when a layer was refreshed
 */
export type RefreshOutcome =
	| {
			readonly kind: 'loaded';
			readonly items: readonly Located<Facility>[];
			readonly source: RefreshSource;
	  }
	| { readonly kind: 'empty'; readonly source: RefreshSource }
	/** A newer refresh (or a disable) cancelled this one; the markers were left alone */
	| { readonly kind: 'superseded' }
	| { readonly kind: 'failed'; readonly error: RefreshError };

/**
 * One layer's outcome from a `refreshLayers` call
 */
export type LayerRefresh = {
	readonly kind: LayerKind;
	readonly outcome: RefreshOutcome;
};

/**
 * Facility loader, shaped like `fetchFacilities`
 */
export type FetchFacilities = (
	query: string,
	bounds: L.LatLngBounds,
	signal?: AbortSignal
) => Promise<Result<readonly Facility[], FetchError>>;

/**
 * Marker renderer, shaped like `addMarkers`
 */
export type AddMarkers = (items: readonly Located<Facility>[], group: FacilityLayerGroup) => void;

/**
 * Collaborators of `refreshLayers`, injectable for tests
 */
export type RefreshDeps = {
	readonly fetchFacilities: FetchFacilities;
	readonly addMarkers: AddMarkers;
};

/**
 * Production collaborators
 */
export const defaultRefreshDeps: RefreshDeps = { fetchFacilities, addMarkers };

/**
 * Split facilities by kind, in `LAYER_KINDS` order
 */
const byKind = (
	facilities: readonly Facility[]
): Readonly<Record<LayerKind, readonly Facility[]>> => {
	const grouped: Record<LayerKind, Facility[]> = { water: [], toilet: [] };
	for (const facility of facilities) {
		grouped[facility.kind].push(facility);
	}
	return grouped;
};

/**
 * Apply one layer's share of a completed fetch or cache read: cleared and skipped when the
 * layer was disabled while the request was in flight, otherwise rendered (unless `render` is
 * false) or reported empty. The outcome is computed either way, so a caller that skips
 * rendering still gets `loaded`/`empty` for notifications and analytics.
 */
const applyToLayer = (
	layer: FacilityLayer,
	facilities: readonly Facility[],
	origin: Origin,
	deps: RefreshDeps,
	source: RefreshSource,
	render: boolean
): RefreshOutcome => {
	if (!layer.active) {
		return { kind: 'superseded' };
	}
	if (facilities.length === 0) {
		if (render) {
			layer.group.clearLayers();
		}
		return { kind: 'empty', source };
	}
	const items = locateFacilities(layer.kind, facilities, origin);
	if (render) {
		layer.group.clearLayers();
		deps.addMarkers(items, layer.group);
	}
	return { kind: 'loaded', items, source };
};

/**
 * Render facilities already known from the offline cache. Runs the same apply step as a
 * network result (partition by kind, locate, render) but never touches the shared `inflight`
 * controller - a cache render neither starts nor cancels a request. Outcomes carry
 * `source: 'cache'`.
 * @param targets - Layers to render into (already filtered to active + requested kinds)
 * @param facilities - Cached facilities to show, both kinds
 * @param origin - Reference point for distances and nearest-marking
 * @param deps - Collaborators (default: real marker rendering)
 */
export const renderCached = (
	targets: readonly FacilityLayer[],
	facilities: readonly Facility[],
	origin: Origin,
	deps: RefreshDeps = defaultRefreshDeps
): readonly LayerRefresh[] => {
	const grouped = byKind(facilities);
	return targets.map((layer) => ({
		kind: layer.kind,
		outcome: applyToLayer(layer, grouped[layer.kind], origin, deps, 'cache', true),
	}));
};

/**
 * Options for `refreshLayers`
 */
export type RefreshOptions = {
	/**
	 * Compute outcomes without rendering them to the layer groups. Used when the caller wants
	 * to merge the fetched facilities into a larger set (e.g. the offline cache) before doing
	 * a single render of the union, instead of a strip render that would briefly hide
	 * everything outside the fetched area.
	 */
	readonly skipRender?: boolean;
};

/**
 * Result of a `refreshLayers` call
 */
export type RefreshResult = {
	readonly layers: readonly LayerRefresh[];
	/** The full facility list fetched (both kinds), or null when nothing was fetched - no
	 * targets, the request failed, or it was superseded */
	readonly fetched: readonly Facility[] | null;
};

/**
 * Refresh every given layer for the same viewport with a single Overpass request: one query
 * composed from all their selectors, one `fetchFacilities` call, and the resulting
 * facilities partitioned by kind before each layer's own apply step (clear, locate, render,
 * or report empty) runs. Any request still in flight for the viewport is aborted first; if
 * this request is itself superseded before it completes - by a newer refresh - every
 * targeted layer's outcome is `superseded` and no markers are touched. A layer disabled
 * after the request started is treated the same way, checked via its `active` flag once the
 * response is in.
 * @param layers - Aggregate whose shared `inflight` controller is replaced for this call
 * @param targets - Layers to refresh (already filtered to active + requested kinds)
 * @param bounds - Visible map area to query
 * @param origin - Reference point for distances and nearest-marking
 * @param deps - Collaborators (default: real fetch and marker rendering)
 * @param options - `skipRender` to compute outcomes without touching the layer groups
 */
export async function refreshLayers(
	layers: FacilityLayers,
	targets: readonly FacilityLayer[],
	bounds: L.LatLngBounds,
	origin: Origin,
	deps: RefreshDeps = defaultRefreshDeps,
	options: RefreshOptions = {}
): Promise<RefreshResult> {
	if (targets.length === 0) {
		return { layers: [], fetched: null };
	}

	abortInflight(layers);
	const controller = new AbortController();
	layers.inflight = controller;

	const query = composeQuery(targets.map((layer) => layer.selector));
	const result = await deps.fetchFacilities(query, bounds, controller.signal);

	const superseded = controller.signal.aborted || layers.inflight !== controller;
	if (!superseded) {
		layers.inflight = null;
	}

	if (isErr(result)) {
		const error = result.error;
		if (superseded || error.type === 'aborted') {
			return {
				layers: targets.map((layer) => ({ kind: layer.kind, outcome: { kind: 'superseded' } })),
				fetched: null,
			};
		}
		return {
			layers: targets.map((layer) => ({ kind: layer.kind, outcome: { kind: 'failed', error } })),
			fetched: null,
		};
	}

	if (superseded) {
		return {
			layers: targets.map((layer) => ({ kind: layer.kind, outcome: { kind: 'superseded' } })),
			fetched: null,
		};
	}

	const grouped = byKind(result.value);
	const render = options.skipRender !== true;
	return {
		layers: targets.map((layer) => ({
			kind: layer.kind,
			outcome: applyToLayer(layer, grouped[layer.kind], origin, deps, 'network', render),
		})),
		fetched: result.value,
	};
}
