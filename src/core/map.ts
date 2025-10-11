/**
 * Map initialization and setup
 */

import * as L from 'leaflet';
import { RIGA_CENTER, DEFAULT_ZOOM, MAX_ZOOM, OSM_TILE_URL, OSM_ATTRIBUTION } from './config';
import { locateUser } from '../features/location/geolocation';
import { isActivationKey } from '../utils/dom';

/**
 * Initialize the Leaflet map
 * @param containerId - ID of the HTML element to contain the map
 * @param center - Optional center coordinates (defaults to Riga)
 * @returns Leaflet Map instance
 */
export function initializeMap(containerId: string, center?: L.LatLngTuple): L.Map {
	const map = L.map(containerId, {
		center: center || RIGA_CENTER,
		zoom: DEFAULT_ZOOM,
		zoomControl: true,
	});

	// Add tile layer
	L.tileLayer(OSM_TILE_URL, {
		maxZoom: MAX_ZOOM,
		attribution: OSM_ATTRIBUTION,
	}).addTo(map);

	// Add scale control
	L.control.scale({ metric: true, imperial: false }).addTo(map);

	return map;
}

/**
 * Create and add locate control to map
 * @param map - Leaflet map instance
 */
export function addLocateControl(map: L.Map): void {
	const LocateControl = L.Control.extend({
		onAdd: () => {
			const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control locate-control');
			const link = L.DomUtil.create('a', '', container);
			link.href = '#';
			link.title = 'Show my location';
			link.setAttribute('aria-label', 'Show my location');
			link.innerHTML = '📍';

			L.DomEvent.on(link, 'click', L.DomEvent.stopPropagation)
				.on(link, 'click', L.DomEvent.preventDefault)
				.on(link, 'click', () => locateUser(map));

			return container;
		},
	});

	new LocateControl({ position: 'topright' }).addTo(map);

	// Add keyboard accessibility
	setTimeout(() => {
		const el = document.querySelector('.leaflet-bar a[title="Show my location"]');
		if (el) {
			el.setAttribute('role', 'button');
			el.setAttribute('tabindex', '0');
			el.addEventListener('keydown', (e) => {
				const keyEvent = e as KeyboardEvent;
				if (isActivationKey(keyEvent)) {
					keyEvent.preventDefault();
					(el as HTMLElement).click();
				}
			});
		}
	}, 100);
}

/**
 * Add layer control for toggling layers
 * @param map - Leaflet map instance
 * @param overlays - Object mapping layer names to layer groups
 */
export function addLayerControl(map: L.Map, overlays: Record<string, L.LayerGroup>): void {
	L.control.layers(undefined, overlays, { collapsed: false }).addTo(map);
}
