import { LAST_POSITION_MAX_AGE_MS, LAST_POSITION_STORAGE_KEY } from '../../core/config';
import type { Timestamp, UserPosition } from '../../domain';
import { heading, meters, metersPerSecond, timestamp } from '../../domain';

type UnknownRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

type ParsedNullableNumber = { readonly present: true; readonly value: number | null };

const parseNullableNumber = (value: unknown): ParsedNullableNumber | null => {
	if (value === null) {
		return { present: true, value: null };
	}
	if (typeof value === 'number') {
		return { present: true, value };
	}
	return null;
};

const parseStoredPosition = (value: unknown): UserPosition | null => {
	if (!isRecord(value)) {
		return null;
	}
	const { lat, lon, accuracy, heading: rawHeading, speed: rawSpeed, at } = value;
	if (typeof lat !== 'number' || typeof lon !== 'number' || typeof accuracy !== 'number') {
		return null;
	}
	const validAccuracy = meters(accuracy);
	if (validAccuracy === null) {
		return null;
	}
	const parsedHeading = parseNullableNumber(rawHeading);
	const parsedSpeed = parseNullableNumber(rawSpeed);
	const parsedAt = typeof at === 'number' ? timestamp(at) : null;
	if (parsedHeading === null || parsedSpeed === null || parsedAt === null) {
		return null;
	}
	const validHeading = parsedHeading.value === null ? null : heading(parsedHeading.value);
	if (parsedHeading.value !== null && validHeading === null) {
		return null;
	}
	const validSpeed = parsedSpeed.value === null ? null : metersPerSecond(parsedSpeed.value);
	if (parsedSpeed.value !== null && validSpeed === null) {
		return null;
	}
	return {
		lat,
		lon,
		accuracy: validAccuracy,
		heading: validHeading,
		speed: validSpeed,
		at: parsedAt,
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
