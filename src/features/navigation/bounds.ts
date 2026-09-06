import * as L from 'leaflet';
import type { TileBounds } from '../../domain';

export const toTileBounds = (bounds: L.LatLngBounds): TileBounds => {
	const sw = bounds.getSouthWest();
	const ne = bounds.getNorthEast();
	return { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng };
};

export const toLatLngBounds = (bounds: TileBounds): L.LatLngBounds =>
	L.latLngBounds([bounds.south, bounds.west], [bounds.north, bounds.east]);
