import { LAST_POSITION_MAX_AGE_MS, LAST_POSITION_STORAGE_KEY } from '../../core/config';
import type { Timestamp, UserPosition } from '../../domain';
import { coordinates, heading, meters, metersPerSecond, timestamp } from '../../domain';

type UnknownRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const nullableNumberField = <T>(
	value: unknown,
	construct: (raw: number) => T | null
): { readonly value: T | null } | null => {
	if (value === null) {
		return { value: null };
	}
	if (typeof value !== 'number') {
		return null;
	}
	const constructed = construct(value);
	return constructed === null ? null : { value: constructed };
};

const parseStoredPosition = (value: unknown): UserPosition | null => {
	if (!isRecord(value)) {
		return null;
	}
	const { lat, lon, accuracy, heading: rawHeading, speed: rawSpeed, at } = value;
	if (
		typeof lat !== 'number' ||
		typeof lon !== 'number' ||
		typeof accuracy !== 'number' ||
		typeof at !== 'number'
	) {
		return null;
	}
	const validCoordinates = coordinates(lat, lon);
	const validAccuracy = meters(accuracy);
	const validAt = timestamp(at);
	const parsedHeading = nullableNumberField(rawHeading, heading);
	const parsedSpeed = nullableNumberField(rawSpeed, metersPerSecond);
	if (
		validCoordinates === null ||
		validAccuracy === null ||
		validAt === null ||
		parsedHeading === null ||
		parsedSpeed === null
	) {
		return null;
	}
	return {
		lat: validCoordinates.lat,
		lon: validCoordinates.lon,
		accuracy: validAccuracy,
		heading: parsedHeading.value,
		speed: parsedSpeed.value,
		at: validAt,
	};
};

export const loadLastKnownPosition = (
	storage: Pick<Storage, 'getItem'>,
	now: Timestamp
): UserPosition | null => {
	const raw = storage.getItem(LAST_POSITION_STORAGE_KEY);
	if (raw === null) {
		return null;
	}
	let parsedJson: unknown;
	try {
		parsedJson = JSON.parse(raw);
	} catch {
		return null;
	}
	const position = parseStoredPosition(parsedJson);
	if (position === null) {
		return null;
	}
	if (now - position.at > LAST_POSITION_MAX_AGE_MS) {
		return null;
	}
	return position;
};

export const saveLastKnownPosition = (
	storage: Pick<Storage, 'setItem'>,
	position: UserPosition
): void => {
	storage.setItem(LAST_POSITION_STORAGE_KEY, JSON.stringify(position));
};
