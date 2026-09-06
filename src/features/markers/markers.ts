import * as L from 'leaflet';
import type { Facility, Located } from '../../domain';
import { attachPopupHandlers, createPopupContent } from './popup';
import { appearanceOf, createFacilityIcon, rootAttributesOf } from './styling';

export type FacilityLayer = L.FeatureGroup<L.Marker>;

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

export function addMarkers(items: readonly Located<Facility>[], layer: FacilityLayer): void {
	for (const item of items) {
		const marker = createFacilityMarker(item);
		marker.addTo(layer);
		marker.bindPopup(createPopupContent(item));
		attachPopupHandlers(marker, item.facility);
	}
}
