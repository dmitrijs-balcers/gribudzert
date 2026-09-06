import * as L from 'leaflet';
import type { LatLon } from '../../domain';

export type BeelineLayer = {
	readonly show: (from: LatLon, to: LatLon) => void;
	readonly clear: () => void;
};

export const createBeelineLayer = (map: L.Map): BeelineLayer => {
	const group = L.layerGroup();
	group.addTo(map);
	let line: L.Polyline | null = null;

	return {
		show: (from, to) => {
			const latLngs: L.LatLngTuple[] = [
				[from.lat, from.lon],
				[to.lat, to.lon],
			];
			if (line !== null) {
				line.setLatLngs(latLngs);
				return;
			}
			const created = L.polyline(latLngs, {
				className: 'beeline',
				interactive: false,
				dashArray: '6 6',
				weight: 2,
				color: '#136AEC',
				opacity: 0.7,
			});
			created.addTo(group);
			line = created;
		},
		clear: () => {
			group.clearLayers();
			line = null;
		},
	};
};
