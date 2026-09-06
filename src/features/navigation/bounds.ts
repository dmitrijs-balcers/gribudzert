import * as L from 'leaflet';
import type { TileBounds } from '../../domain';

const sizeMultiplierToLeafletPadRatio = (sizeMultiplier: number): number =>
	(sizeMultiplier - 1) / 2;

export const padBounds = (bounds: L.LatLngBounds, factor: number): L.LatLngBounds =>
	bounds.pad(sizeMultiplierToLeafletPadRatio(factor));

export const toTileBounds = (bounds: L.LatLngBounds): TileBounds => {
	const sw = bounds.getSouthWest();
	const ne = bounds.getNorthEast();
	return { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng };
};

export const toLatLngBounds = (bounds: TileBounds): L.LatLngBounds =>
	L.latLngBounds([bounds.south, bounds.west], [bounds.north, bounds.east]);
