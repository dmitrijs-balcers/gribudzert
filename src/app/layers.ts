/**
 * Facility layers
 * A FacilityLayer is the aggregate for one kind of facility on the map: it owns the Leaflet
 * group holding the markers, knows the Overpass query that fills it, and tracks the single
 * request allowed to be in flight for it. Refreshing a layer aborts the previous request,
 * and a superseded request never touches the markers.
 */

import * as L from 'leaflet';
import type { LayerName } from '../core/config';
import { LAYER_NAMES } from '../core/config';
import type { Facility, FacilityKind, Located } from '../domain';
import { markNearest, withDistances } from '../domain';
import { fetchFacilities } from '../features/data';
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
	/** Overpass QL query with `[bbox]` placeholders */
	readonly query: string;
	readonly group: FacilityLayerGroup;
	/** Whether the layer is on the map and should follow viewport changes */
	active: boolean;
	/** Controller of the request currently loading this layer, if any */
	inflight: AbortController | null;
};

/**
 * All facility layers, keyed by kind
 */
export type FacilityLayers = Readonly<Record<LayerKind, FacilityLayer>>;

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
 * @param query - Overpass QL query for this kind
 * @param group - Leaflet group to render into (default: a fresh feature group)
 */
export const createFacilityLayer = (
	kind: LayerKind,
	query: string,
	group: FacilityLayerGroup = L.featureGroup()
): FacilityLayer => ({
	kind,
	label: labelOf(kind),
	query,
	group,
	active: false,
	inflight: null,
});

/**
 * Create one layer per kind
 * @param queries - Overpass QL query per kind
 */
export const createFacilityLayers = (
	queries: Readonly<Record<LayerKind, string>>
): FacilityLayers => ({
	water: createFacilityLayer('water', queries.water),
	toilet: createFacilityLayer('toilet', queries.toilet),
});

/**
 * The part of a Leaflet map a layer needs to attach itself
 */
export type LayerHost = Pick<L.Map, 'addLayer' | 'removeLayer'>;

/**
 * Abort the in-flight request of a layer, if any
 */
export const abortInflight = (layer: FacilityLayer): void => {
	if (layer.inflight !== null) {
		layer.inflight.abort();
		layer.inflight = null;
	}
};

/**
 * Drop every marker and cancel any request that would add more
 */
export const clearLayerMarkers = (layer: FacilityLayer): void => {
	abortInflight(layer);
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
 * Take the layer off the map, drop its markers and cancel any pending request
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
 * What happened when a layer was refreshed
 */
export type RefreshOutcome =
	| { readonly kind: 'loaded'; readonly items: readonly Located<Facility>[] }
	| { readonly kind: 'empty' }
	/** A newer refresh (or a disable) cancelled this one; the markers were left alone */
	| { readonly kind: 'superseded' }
	| { readonly kind: 'failed'; readonly error: RefreshError };

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
 * Collaborators of `refreshLayer`, injectable for tests
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
 * Reload the layer for the given bounds. Any request still in flight for the layer is
 * aborted first; if this request is itself superseded before it completes, its result is
 * discarded and the markers are not touched.
 * @param layer - Layer to refresh
 * @param bounds - Visible map area to query
 * @param origin - Reference point for distances and nearest-marking
 * @param deps - Collaborators (default: real fetch and marker rendering)
 */
export async function refreshLayer(
	layer: FacilityLayer,
	bounds: L.LatLngBounds,
	origin: Origin,
	deps: RefreshDeps = defaultRefreshDeps
): Promise<RefreshOutcome> {
	abortInflight(layer);
	const controller = new AbortController();
	layer.inflight = controller;

	const result = await deps.fetchFacilities(layer.query, bounds, controller.signal);

	if (controller.signal.aborted || layer.inflight !== controller) {
		return { kind: 'superseded' };
	}
	layer.inflight = null;

	if (isErr(result)) {
		const error = result.error;
		if (error.type === 'aborted') {
			return { kind: 'superseded' };
		}
		return { kind: 'failed', error };
	}

	if (result.value.length === 0) {
		layer.group.clearLayers();
		return { kind: 'empty' };
	}

	const items = locateFacilities(layer.kind, result.value, origin);
	layer.group.clearLayers();
	deps.addMarkers(items, layer.group);
	return { kind: 'loaded', items };
}
