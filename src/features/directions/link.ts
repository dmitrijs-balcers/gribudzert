import type { DirectionsApp, LatLon } from '../../domain';

export type DirectionsDestination = {
	readonly coordinates: LatLon;
	readonly name: string;
};

const latLonQuery = ({ lat, lon }: LatLon): string => `${String(lat)},${String(lon)}`;

const appleMapsWalkingLink = (destination: DirectionsDestination): string =>
	`https://maps.apple.com/directions?destination=${latLonQuery(destination.coordinates)}&mode=walking`;

/**
 * Universal link: opens the OsmAnd app with a pedestrian route when it is
 * installed, and the OsmAnd web planner otherwise.
 */
const osmandWalkingLink = (destination: DirectionsDestination): string =>
	`https://osmand.net/map/navigate?end=${latLonQuery(destination.coordinates)}&profile=pedestrian`;

const encodeGeoLabel = (name: string): string =>
	encodeURIComponent(name).replaceAll('(', '%28').replaceAll(')', '%29');

const androidGeoLink = (destination: DirectionsDestination): string => {
	const point = latLonQuery(destination.coordinates);
	return `geo:${point}?q=${point}(${encodeGeoLabel(destination.name)})`;
};

const googleMapsWalkingLink = (destination: DirectionsDestination): string =>
	`https://www.google.com/maps/dir/?api=1&destination=${latLonQuery(destination.coordinates)}&travelmode=walking`;

export const directionsLink = (app: DirectionsApp, destination: DirectionsDestination): string => {
	switch (app) {
		case 'apple-maps':
			return appleMapsWalkingLink(destination);
		case 'osmand':
			return osmandWalkingLink(destination);
		case 'device-chooser':
			return androidGeoLink(destination);
		case 'google-maps':
			return googleMapsWalkingLink(destination);
		default: {
			const exhaustive: never = app;
			return exhaustive;
		}
	}
};
