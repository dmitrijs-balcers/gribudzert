import * as L from 'leaflet';
import type { LatLon } from '../../domain';

export type BeelineLayer = {
	readonly group: L.LayerGroup;
	line: L.Polyline | null;
};

export const createBeelineLayer = (map: L.Map): BeelineLayer => {
	const group = L.layerGroup();
	group.addTo(map);
	return { group, line: null };
};

export const showBeeline = (layer: BeelineLayer, from: LatLon, to: LatLon): void => {
	const latLngs: L.LatLngTuple[] = [
		[from.lat, from.lon],
		[to.lat, to.lon],
	];
	if (layer.line !== null) {
		layer.line.setLatLngs(latLngs);
		return;
	}
	const line = L.polyline(latLngs, {
		className: 'beeline',
		interactive: false,
		dashArray: '6 6',
		weight: 2,
		color: '#136AEC',
		opacity: 0.7,
	});
	line.addTo(layer.group);
	layer.line = line;
};

export const clearBeeline = (layer: BeelineLayer): void => {
	layer.group.clearLayers();
	layer.line = null;
};
