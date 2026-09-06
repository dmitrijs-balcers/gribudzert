import * as L from 'leaflet';
import type { LayerName } from '../core/config';
import { LAYER_NAMES } from '../core/config';
import type { Facility, FacilityKind, Located } from '../domain';
import { markNearest, withDistances } from '../domain';
import type { OverpassQuery, OverpassSelector } from '../features/data';
import { composeQuery, fetchFacilities } from '../features/data';
import { addMarkers } from '../features/markers/markers';
import type { FetchError } from '../types/errors';
import type { Result } from '../types/result';
import { isErr } from '../types/result';
import type { Origin } from './session';

export type LayerKind = FacilityKind;

export const LAYER_KINDS: readonly LayerKind[] = ['water', 'toilet'];

export type FacilityLayerGroup = L.FeatureGroup<L.Marker>;

export type FacilityLayer = {
	readonly kind: LayerKind;
	readonly label: LayerName;
	readonly selector: OverpassSelector;
	readonly group: FacilityLayerGroup;
	active: boolean;
};

export type SharedViewportRequestState =
	| { readonly status: 'idle' }
	| { readonly status: 'inflight'; readonly controller: AbortController };

export type FacilityLayers = Readonly<Record<LayerKind, FacilityLayer>> & {
	sharedViewportRequest: SharedViewportRequestState;
};

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

const KIND_BY_LABEL: Readonly<Record<LayerName, LayerKind>> = {
	[LAYER_NAMES.WATER]: 'water',
	[LAYER_NAMES.TOILET]: 'toilet',
};

export const isLayerName = (name: string): name is LayerName => Object.hasOwn(KIND_BY_LABEL, name);

export const layerKindOf = (name: string): LayerKind | null =>
	isLayerName(name) ? KIND_BY_LABEL[name] : null;

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

export const createFacilityLayers = (
	selectors: Readonly<Record<LayerKind, OverpassSelector>>
): FacilityLayers => ({
	water: createFacilityLayer('water', selectors.water),
	toilet: createFacilityLayer('toilet', selectors.toilet),
	sharedViewportRequest: { status: 'idle' },
});

export type LayerHost = Pick<L.Map, 'addLayer' | 'removeLayer'>;

export const abortSharedViewportRequest = (layers: FacilityLayers): void => {
	if (layers.sharedViewportRequest.status === 'inflight') {
		layers.sharedViewportRequest.controller.abort();
		layers.sharedViewportRequest = { status: 'idle' };
	}
};

export const clearLayerMarkers = (layer: FacilityLayer): void => {
	layer.group.clearLayers();
};

export const enableLayer = (layer: FacilityLayer, host: LayerHost): void => {
	layer.active = true;
	host.addLayer(layer.group);
};

export const disableLayer = (layer: FacilityLayer, host: LayerHost): void => {
	layer.active = false;
	clearLayerMarkers(layer);
	host.removeLayer(layer.group);
};

export const activeLayers = (layers: FacilityLayers): readonly FacilityLayer[] =>
	LAYER_KINDS.map((kind) => layers[kind]).filter((layer) => layer.active);

export const activeLayerCount = (layers: FacilityLayers): number => activeLayers(layers).length;

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

export type UserFacingFetchError = Exclude<FetchError, { readonly type: 'aborted' }>;

export type RefreshSource = 'cache' | 'network';

export type RefreshOutcome =
	| {
			readonly kind: 'loaded';
			readonly items: readonly Located<Facility>[];
			readonly source: RefreshSource;
	  }
	| { readonly kind: 'empty'; readonly source: RefreshSource }
	| { readonly kind: 'superseded' }
	| { readonly kind: 'failed'; readonly error: UserFacingFetchError };

export type LayerRefresh = {
	readonly kind: LayerKind;
	readonly outcome: RefreshOutcome;
};

export type FetchFacilities = (
	query: OverpassQuery,
	bounds: L.LatLngBounds,
	signal?: AbortSignal
) => Promise<Result<readonly Facility[], FetchError>>;

export type AddMarkers = (items: readonly Located<Facility>[], group: FacilityLayerGroup) => void;

export type RefreshDeps = {
	readonly fetchFacilities: FetchFacilities;
	readonly addMarkers: AddMarkers;
};

export const defaultRefreshDeps: RefreshDeps = { fetchFacilities, addMarkers };

const byKind = (
	facilities: readonly Facility[]
): Readonly<Record<LayerKind, readonly Facility[]>> => {
	const grouped: Record<LayerKind, Facility[]> = { water: [], toilet: [] };
	for (const facility of facilities) {
		grouped[facility.kind].push(facility);
	}
	return grouped;
};

export type MarkerRendering = 'render' | 'defer';

export type FailureNotification =
	| { readonly kind: 'none' }
	| { readonly kind: 'all' }
	| { readonly kind: 'only'; readonly layer: LayerKind };

const applyToLayer = (
	layer: FacilityLayer,
	facilities: readonly Facility[],
	origin: Origin,
	deps: RefreshDeps,
	source: RefreshSource,
	rendering: MarkerRendering
): RefreshOutcome => {
	if (!layer.active) {
		return { kind: 'superseded' };
	}
	if (facilities.length === 0) {
		if (rendering === 'render') {
			layer.group.clearLayers();
		}
		return { kind: 'empty', source };
	}
	const items = locateFacilities(layer.kind, facilities, origin);
	if (rendering === 'render') {
		layer.group.clearLayers();
		deps.addMarkers(items, layer.group);
	}
	return { kind: 'loaded', items, source };
};

export const renderCached = (
	targets: readonly FacilityLayer[],
	facilities: readonly Facility[],
	origin: Origin,
	deps: RefreshDeps = defaultRefreshDeps
): readonly LayerRefresh[] => {
	const grouped = byKind(facilities);
	return targets.map((layer) => ({
		kind: layer.kind,
		outcome: applyToLayer(layer, grouped[layer.kind], origin, deps, 'cache', 'render'),
	}));
};

export type RefreshOptions = {
	readonly rendering?: MarkerRendering;
};

export type RefreshResult =
	| { readonly kind: 'nothing-to-refresh' }
	| {
			readonly kind: 'fetched';
			readonly facilities: readonly Facility[];
			readonly layers: readonly LayerRefresh[];
	  }
	| { readonly kind: 'superseded' }
	| {
			readonly kind: 'failed';
			readonly error: UserFacingFetchError;
			readonly kinds: readonly LayerKind[];
	  };

export async function refreshLayers(
	layers: FacilityLayers,
	targets: readonly FacilityLayer[],
	bounds: L.LatLngBounds,
	origin: Origin,
	deps: RefreshDeps = defaultRefreshDeps,
	options: RefreshOptions = {}
): Promise<RefreshResult> {
	if (targets.length === 0) {
		return { kind: 'nothing-to-refresh' };
	}

	abortSharedViewportRequest(layers);
	const controller = new AbortController();
	layers.sharedViewportRequest = { status: 'inflight', controller };

	const query = composeQuery(targets.map((layer) => layer.selector));
	const result = await deps.fetchFacilities(query, bounds, controller.signal);

	const currentRequest = layers.sharedViewportRequest;
	const superseded =
		controller.signal.aborted ||
		currentRequest.status !== 'inflight' ||
		currentRequest.controller !== controller;
	if (!superseded) {
		layers.sharedViewportRequest = { status: 'idle' };
	}

	if (isErr(result)) {
		const error = result.error;
		if (superseded || error.type === 'aborted') {
			return { kind: 'superseded' };
		}
		return { kind: 'failed', error, kinds: targets.map((layer) => layer.kind) };
	}

	if (superseded) {
		return { kind: 'superseded' };
	}

	const grouped = byKind(result.value);
	const rendering = options.rendering ?? 'render';
	return {
		kind: 'fetched',
		facilities: result.value,
		layers: targets.map((layer) => ({
			kind: layer.kind,
			outcome: applyToLayer(layer, grouped[layer.kind], origin, deps, 'network', rendering),
		})),
	};
}
