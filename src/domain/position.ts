import { MOVING_SPEED_THRESHOLD_MPS } from '../core/config';
import type { Heading, Latitude, Longitude, Meters, MetersPerSecond } from './geo';
import { coordinates, heading, meters, metersPerSecond } from './geo';
import type { Timestamp } from './units';
import { timestamp, timestampNow } from './units';

export type UserPosition = {
	readonly lat: Latitude;
	readonly lon: Longitude;
	readonly accuracy: Meters;
	readonly heading: Heading | null;
	readonly speed: MetersPerSecond | null;
	readonly at: Timestamp;
};

export const isMoving = (position: UserPosition): boolean =>
	position.speed !== null && position.speed >= MOVING_SPEED_THRESHOLD_MPS;

const timestampOf = (raw: GeolocationPosition): Timestamp =>
	timestamp(raw.timestamp) ?? timestampNow();

const speedOf = (raw: GeolocationPosition): MetersPerSecond | null => {
	const rawSpeed = raw.coords.speed;
	return rawSpeed === null ? null : metersPerSecond(rawSpeed);
};

const headingOf = (raw: GeolocationPosition, speed: MetersPerSecond | null): Heading | null => {
	if (speed === null || speed < MOVING_SPEED_THRESHOLD_MPS) {
		return null;
	}
	const rawHeading = raw.coords.heading;
	return rawHeading === null ? null : heading(rawHeading);
};

export const toUserPosition = (raw: GeolocationPosition): UserPosition | null => {
	const validCoordinates = coordinates(raw.coords.latitude, raw.coords.longitude);
	const validAccuracy = meters(raw.coords.accuracy);
	if (validCoordinates === null || validAccuracy === null) {
		return null;
	}
	const speed = speedOf(raw);
	return {
		lat: validCoordinates.lat,
		lon: validCoordinates.lon,
		accuracy: validAccuracy,
		heading: headingOf(raw, speed),
		speed,
		at: timestampOf(raw),
	};
};
