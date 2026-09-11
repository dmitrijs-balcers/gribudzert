import * as L from 'leaflet';
import { trackMarkerClicked } from '../../analytics';
import type { Facility, Located } from '../../domain';
import { appearanceOf, createFacilityIcon, rootAttributesOf } from './styling';

export type FacilityLayer = L.FeatureGroup<L.Marker>;

export type MarkerHandlers = {
	readonly onSelect: (item: Located<Facility>) => void;
};

export const SELECTED_MARKER_CLASS = 'facility-marker--selected';

const applyRootAttributes = (
	marker: L.Marker,
	attributes: Readonly<Record<string, string>>
): void => {
	marker.on('add', () => {
		const element = marker.getElement();
		if (element === undefined) {
			return;
		}
		for (const [name, value] of Object.entries(attributes)) {
			element.setAttribute(name, value);
		}
	});
};

export function createFacilityMarker(item: Located<Facility>): L.Marker {
	const appearance = appearanceOf(item.facility, {
		isNearest: item.isNearest,
		distance: item.distance,
	});
	const marker = L.marker([item.facility.coordinates.lat, item.facility.coordinates.lon], {
		icon: createFacilityIcon(appearance),
	});
	applyRootAttributes(marker, rootAttributesOf(appearance));
	return marker;
}

const attachSelectHandler = (
	marker: L.Marker,
	item: Located<Facility>,
	handlers: MarkerHandlers
): void => {
	marker.on('click', () => {
		trackMarkerClicked(item.facility.kind);
		handlers.onSelect(item);
	});
};

export function addMarkers(
	items: readonly Located<Facility>[],
	layer: FacilityLayer,
	handlers: MarkerHandlers
): void {
	for (const item of items) {
		const marker = createFacilityMarker(item);
		marker.addTo(layer);
		attachSelectHandler(marker, item, handlers);
	}
}
