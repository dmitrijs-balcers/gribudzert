import * as L from 'leaflet';
import { trackMarkerClicked } from '../../analytics';
import type { Facility, Located } from '../../domain';
import { appearanceOf, createFacilityIcon, rootAttributesOf } from './styling';

export type MarkerHandlers = {
	readonly onSelect: (item: Located<Facility>) => void;
};

export const SELECTED_MARKER_CLASS = 'facility-marker--selected';
export const SELECTED_MARKER_Z_OFFSET = 1000;

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

export const attachSelectHandler = (
	marker: L.Marker,
	item: Located<Facility>,
	handlers: MarkerHandlers
): void => {
	marker.on('click', () => {
		trackMarkerClicked(item.facility.kind);
		handlers.onSelect(item);
	});
};

export const setMarkerHighlighted = (marker: L.Marker, highlighted: boolean): void => {
	marker.getElement()?.classList.toggle(SELECTED_MARKER_CLASS, highlighted);
	marker.setZIndexOffset(highlighted ? SELECTED_MARKER_Z_OFFSET : 0);
};
