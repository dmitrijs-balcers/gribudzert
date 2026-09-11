import type * as L from 'leaflet';
import type { Facility, FacilityId, FacilityKind, Located } from '../../domain';
import { sameLocatedList } from '../../domain';
import type { MarkerHandlers } from './markers';
import { attachSelectHandler, createFacilityMarker, setMarkerHighlighted } from './markers';

export type MarkerLayerRender = {
	readonly kind: FacilityKind;
	readonly items: readonly Located<Facility>[];
};

export type MarkerGroups = Readonly<Record<FacilityKind, L.FeatureGroup<L.Marker>>>;

export type MarkerRenderer = {
	readonly render: (renders: readonly MarkerLayerRender[]) => void;
	readonly clear: (kind: FacilityKind) => void;
	readonly clearAll: () => void;
	readonly select: (id: FacilityId | null) => void;
	readonly destroy: () => void;
};

const MARKER_KINDS: readonly FacilityKind[] = ['water', 'toilet', 'viewpoint'];

type RenderedKind = {
	readonly items: readonly Located<Facility>[];
	readonly markers: ReadonlyMap<FacilityId, L.Marker>;
};

const createMarkers = (
	items: readonly Located<Facility>[],
	group: L.FeatureGroup<L.Marker>,
	handlers: MarkerHandlers,
	isSelected: (id: FacilityId) => boolean
): ReadonlyMap<FacilityId, L.Marker> => {
	const markers = new Map<FacilityId, L.Marker>();
	for (const item of items) {
		const id = item.facility.id;
		const marker = createFacilityMarker(item);
		attachSelectHandler(marker, item, handlers);
		marker.on('add', () => setMarkerHighlighted(marker, isSelected(id)));
		marker.addTo(group);
		markers.set(id, marker);
	}
	return markers;
};

export const createMarkerRenderer = (
	groups: MarkerGroups,
	handlers: MarkerHandlers
): MarkerRenderer => {
	const rendered = new Map<FacilityKind, RenderedKind>();
	let selectedId: FacilityId | null = null;

	const isSelected = (id: FacilityId): boolean => id === selectedId;

	const markerOf = (id: FacilityId | null): L.Marker | null => {
		if (id === null) {
			return null;
		}
		for (const kind of MARKER_KINDS) {
			const marker = rendered.get(kind)?.markers.get(id);
			if (marker !== undefined) {
				return marker;
			}
		}
		return null;
	};

	const highlightSelected = (): void => {
		const marker = markerOf(selectedId);
		if (marker !== null) {
			setMarkerHighlighted(marker, true);
		}
	};

	const clear = (kind: FacilityKind): void => {
		groups[kind].clearLayers();
		rendered.delete(kind);
	};

	const renderKind = (layerRender: MarkerLayerRender): void => {
		const previous = rendered.get(layerRender.kind);
		if (previous !== undefined && sameLocatedList(previous.items, layerRender.items)) {
			return;
		}
		clear(layerRender.kind);
		rendered.set(layerRender.kind, {
			items: layerRender.items,
			markers: createMarkers(layerRender.items, groups[layerRender.kind], handlers, isSelected),
		});
	};

	const clearAll = (): void => {
		for (const kind of MARKER_KINDS) {
			clear(kind);
		}
	};

	return {
		render: (renders) => {
			for (const layerRender of renders) {
				renderKind(layerRender);
			}
			highlightSelected();
		},
		clear,
		clearAll,
		select: (id) => {
			const previous = markerOf(selectedId);
			if (previous !== null) {
				setMarkerHighlighted(previous, false);
			}
			selectedId = id;
			highlightSelected();
		},
		destroy: () => {
			selectedId = null;
			clearAll();
		},
	};
};
