import { MOVING_SPEED_THRESHOLD_MPS } from '../core/config';
import type { Heading, Meters, MetersPerSecond } from './geo';
import { heading, meters, metersPerSecond } from './geo';
import type { Timestamp } from './units';
import { timestamp, timestampNow } from './units';

export type UserPosition = {
	readonly lat: number;
	readonly lon: number;
	readonly accuracy: Meters;
	readonly heading: Heading | null;
	readonly speed: MetersPerSecond | null;
	readonly at: Timestamp;
};

export const isMoving = (position: UserPosition): boolean =>
	position.speed !== null && position.speed >= MOVING_SPEED_THRESHOLD_MPS;

const accuracyOf = (raw: GeolocationPosition): Meters => {
	const value = meters(raw.coords.accuracy);
	if (value === null) {
		throw new Error(`GeolocationPosition reported an invalid accuracy: ${raw.coords.accuracy}`);
	}
	return value;
};

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

export const toUserPosition = (raw: GeolocationPosition): UserPosition => {
	const speed = speedOf(raw);
	return {
		lat: raw.coords.latitude,
		lon: raw.coords.longitude,
		accuracy: accuracyOf(raw),
		heading: headingOf(raw, speed),
		speed,
		at: timestampOf(raw),
	};
};
