import * as L from 'leaflet';
import type { LayerName } from '../core/config';
import { LAYER_NAMES } from '../core/config';
import type { Facility, FacilityKind, LatLon, Located } from '../domain';
import { markNearest, withDistances } from '../domain';
import type { OverpassSelector } from '../features/data';
import type { FetchError } from '../types/errors';

export type LayerKind = FacilityKind;

export const LAYER_KINDS: readonly LayerKind[] = ['water', 'toilet', 'viewpoint'];

export type FacilityLayerGroup = L.FeatureGroup<L.Marker>;

export type FacilityLayer = {
	readonly kind: LayerKind;
	readonly label: LayerName;
	readonly selector: OverpassSelector;
	readonly group: FacilityLayerGroup;
	active: boolean;
};

export type FacilityLayers = Readonly<Record<LayerKind, FacilityLayer>>;

export const labelOf = (kind: LayerKind): LayerName => {
	switch (kind) {
		case 'water':
			return LAYER_NAMES.WATER;
		case 'toilet':
			return LAYER_NAMES.TOILET;
		case 'viewpoint':
			return LAYER_NAMES.VIEWPOINT;
		default: {
			const exhaustive: never = kind;
			return exhaustive;
		}
	}
};

const KIND_BY_LABEL: Readonly<Record<LayerName, LayerKind>> = {
	[LAYER_NAMES.WATER]: 'water',
	[LAYER_NAMES.TOILET]: 'toilet',
	[LAYER_NAMES.VIEWPOINT]: 'viewpoint',
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
	viewpoint: createFacilityLayer('viewpoint', selectors.viewpoint),
});

export type LayerHost = Pick<L.Map, 'addLayer' | 'removeLayer'>;

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
	origin: LatLon
): readonly Located<Facility>[] => {
	const located = withDistances(facilities, origin);
	switch (kind) {
		case 'water':
			return markNearest(located);
		case 'toilet':
		case 'viewpoint':
			return located;
		default: {
			const exhaustive: never = kind;
			return exhaustive;
		}
	}
};

export type UserFacingFetchError = Exclude<FetchError, { readonly type: 'aborted' }>;
