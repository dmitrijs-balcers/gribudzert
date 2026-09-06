import * as L from 'leaflet';
import { ACCURACY_CIRCLE_MAX_M, USER_LOCATION_STYLE } from '../../core/config';
import type { UserPosition } from '../../domain';
import { isMoving } from '../../domain';

export type UserLocationFreshness = 'live' | 'stale';

export type UserLocationLayer = {
	readonly group: L.LayerGroup;
	marker: L.Marker | null;
	circle: L.Circle | null;
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

export const createUserLocationLayer = (map: L.Map): UserLocationLayer => {
	const group = L.layerGroup();
	group.addTo(map);
	return { group, marker: null, circle: null };
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

const ensureMarker = (layer: UserLocationLayer, latLng: L.LatLngTuple): L.Marker => {
	if (layer.marker !== null) {
		layer.marker.setLatLng(latLng);
		return layer.marker;
	}
	const marker = L.marker(latLng, { icon: createUserIcon() });
	marker.addTo(layer.group);
	layer.marker = marker;
	return marker;
};

const ensureCircle = (layer: UserLocationLayer, latLng: L.LatLngTuple, radius: number): void => {
	if (layer.circle !== null) {
		layer.circle.setLatLng(latLng);
		layer.circle.setRadius(radius);
		return;
	}
	const circle = L.circle(latLng, {
		radius,
		color: USER_LOCATION_STYLE.color,
		fillColor: USER_LOCATION_STYLE.fillColor,
		fillOpacity: USER_LOCATION_STYLE.fillOpacity,
	});
	circle.addTo(layer.group);
	layer.circle = circle;
};

const removeCircle = (layer: UserLocationLayer): void => {
	if (layer.circle !== null) {
		layer.group.removeLayer(layer.circle);
		layer.circle = null;
	}
};

export const showUserPosition = (
	layer: UserLocationLayer,
	position: UserPosition,
	freshness: UserLocationFreshness
): void => {
	const latLng: L.LatLngTuple = [position.lat, position.lon];
	const marker = ensureMarker(layer, latLng);
	const popup = marker.getPopup();
	if (popup === undefined) {
		marker.bindPopup(popupTextOf(position));
	} else {
		popup.setContent(popupTextOf(position));
	}
	const element = marker.getElement();
	if (element !== undefined) {
		applyMarkerAttributes(element, freshness, position);
	}

	if (position.accuracy > ACCURACY_CIRCLE_MAX_M) {
		removeCircle(layer);
		return;
	}
	ensureCircle(layer, latLng, position.accuracy);
};

export const hideUserPosition = (layer: UserLocationLayer): void => {
	layer.group.clearLayers();
	layer.marker = null;
	layer.circle = null;
};
