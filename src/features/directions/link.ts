import type { LatLon } from '../../domain';
import type { DirectionsPlatform } from './platform';

export type DirectionsDestination = {
	readonly coordinates: LatLon;
	readonly name: string;
};

const latLonQuery = ({ lat, lon }: LatLon): string => `${String(lat)},${String(lon)}`;

const appleMapsWalkingLink = (destination: DirectionsDestination): string =>
	`https://maps.apple.com/directions?destination=${latLonQuery(destination.coordinates)}&mode=walking`;

const encodeGeoLabel = (name: string): string =>
	encodeURIComponent(name).replaceAll('(', '%28').replaceAll(')', '%29');

const androidGeoLink = (destination: DirectionsDestination): string => {
	const point = latLonQuery(destination.coordinates);
	return `geo:${point}?q=${point}(${encodeGeoLabel(destination.name)})`;
};

const googleMapsWalkingLink = (destination: DirectionsDestination): string =>
	`https://www.google.com/maps/dir/?api=1&destination=${latLonQuery(destination.coordinates)}&travelmode=walking`;

export const directionsLink = (
	platform: DirectionsPlatform,
	destination: DirectionsDestination
): string => {
	switch (platform) {
		case 'apple':
			return appleMapsWalkingLink(destination);
		case 'android':
			return androidGeoLink(destination);
		case 'web':
			return googleMapsWalkingLink(destination);
		default: {
			const exhaustive: never = platform;
			return exhaustive;
		}
	}
};
