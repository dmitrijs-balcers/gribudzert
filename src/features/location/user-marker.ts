import * as L from 'leaflet';
import { ACCURACY_CIRCLE_MAX_M, USER_LOCATION_STYLE } from '../../core/config';
import type { UserPosition } from '../../domain';
import { isMoving } from '../../domain';

export type UserLocationFreshness = 'live' | 'stale';

export type UserLocationLayer = {
	readonly show: (position: UserPosition, freshness: UserLocationFreshness) => void;
	readonly hide: () => void;
};

const USER_MARKER_HTML =
	'<div class="user-location-halo"></div>' +
	'<div class="user-location-dot"></div>' +
	'<div class="user-location-heading"></div>';

const createUserIcon = (): L.DivIcon =>
	L.divIcon({
		className: 'user-location-marker',
		html: USER_MARKER_HTML,
		iconSize: [28, 28],
		iconAnchor: [14, 14],
	});

const speedKmh = (position: UserPosition): number =>
	position.speed === null ? 0 : position.speed * 3.6;

const popupTextOf = (position: UserPosition): string => {
	const base = `You are here (±${Math.round(position.accuracy)} m)`;
	return isMoving(position) ? `${base} · ${speedKmh(position).toFixed(1)} km/h` : base;
};

const applyMarkerAttributes = (
	element: HTMLElement,
	freshness: UserLocationFreshness,
	position: UserPosition
): void => {
	element.setAttribute('data-freshness', freshness);
	element.setAttribute('data-moving', String(isMoving(position)));
	if (position.heading !== null) {
		element.style.setProperty('--heading', `${position.heading}deg`);
	} else {
		element.style.removeProperty('--heading');
	}
};

export const createUserLocationLayer = (map: L.Map): UserLocationLayer => {
	const group = L.layerGroup();
	group.addTo(map);
	let marker: L.Marker | null = null;
	let circle: L.Circle | null = null;

	const ensureMarker = (latLng: L.LatLngTuple): L.Marker => {
		if (marker !== null) {
			marker.setLatLng(latLng);
			return marker;
		}
		const created = L.marker(latLng, { icon: createUserIcon() });
		created.addTo(group);
		marker = created;
		return created;
	};

	const ensureCircle = (latLng: L.LatLngTuple, radius: number): void => {
		if (circle !== null) {
			circle.setLatLng(latLng);
			circle.setRadius(radius);
			return;
		}
		const created = L.circle(latLng, {
			radius,
			color: USER_LOCATION_STYLE.color,
			fillColor: USER_LOCATION_STYLE.fillColor,
			fillOpacity: USER_LOCATION_STYLE.fillOpacity,
		});
		created.addTo(group);
		circle = created;
	};

	const removeCircle = (): void => {
		if (circle !== null) {
			group.removeLayer(circle);
			circle = null;
		}
	};

	return {
		show: (position, freshness) => {
			const latLng: L.LatLngTuple = [position.lat, position.lon];
			const activeMarker = ensureMarker(latLng);
			const popup = activeMarker.getPopup();
			if (popup === undefined) {
				activeMarker.bindPopup(popupTextOf(position));
			} else {
				popup.setContent(popupTextOf(position));
			}
			const element = activeMarker.getElement();
			if (element !== undefined) {
				applyMarkerAttributes(element, freshness, position);
			}

			if (position.accuracy > ACCURACY_CIRCLE_MAX_M) {
				removeCircle();
				return;
			}
			ensureCircle(latLng, position.accuracy);
		},
		hide: () => {
			group.clearLayers();
			marker = null;
			circle = null;
		},
	};
};
