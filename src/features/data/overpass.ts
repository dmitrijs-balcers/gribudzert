import type { Coordinates, Facility, OsmTags } from '../../domain';
import { coordinates, facilityFromTags } from '../../domain';
import type { FetchError } from '../../types/errors';
import type { Result } from '../../types/result';
import { Err, Ok } from '../../types/result';

export type OverpassCenter = {
	readonly lat: number;
	readonly lon: number;
};

export type OverpassTags = OsmTags;

export type OverpassNode = {
	readonly type: 'node';
	readonly id: number;
	readonly lat: number;
	readonly lon: number;
	readonly tags?: OverpassTags;
};

export type OverpassWay = {
	readonly type: 'way';
	readonly id: number;
	readonly center?: OverpassCenter;
	readonly tags?: OverpassTags;
};

export type OverpassRelation = {
	readonly type: 'relation';
	readonly id: number;
	readonly center?: OverpassCenter;
	readonly tags?: OverpassTags;
};

export type OverpassElement = OverpassNode | OverpassWay | OverpassRelation;

export type OverpassResponse = {
	readonly elements: readonly OverpassElement[];
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

const isTags = (value: unknown): value is OverpassTags =>
	isRecord(value) && Object.values(value).every((tag) => typeof tag === 'string');

const isCenter = (value: unknown): value is OverpassCenter =>
	isRecord(value) && isFiniteNumber(value.lat) && isFiniteNumber(value.lon);

export const isOverpassElement = (value: unknown): value is OverpassElement => {
	if (!isRecord(value) || !isFiniteNumber(value.id)) {
		return false;
	}
	if (value.tags !== undefined && !isTags(value.tags)) {
		return false;
	}
	switch (value.type) {
		case 'node':
			return isFiniteNumber(value.lat) && isFiniteNumber(value.lon);
		case 'way':
		case 'relation':
			return value.center === undefined || isCenter(value.center);
		default:
			return false;
	}
};

export const parseOverpassResponse = (
	json: unknown
): Result<readonly OverpassElement[], FetchError> => {
	if (!isRecord(json)) {
		return Err({ type: 'parse', message: 'Overpass response is not a JSON object' });
	}
	const elements = json.elements;
	if (!Array.isArray(elements)) {
		return Err({ type: 'parse', message: 'Overpass response is missing an "elements" array' });
	}
	return Ok(elements.filter(isOverpassElement));
};

export const elementCoordinates = (element: OverpassElement): Coordinates | null => {
	const point = element.type === 'node' ? element : element.center;
	return point === undefined ? null : coordinates(point.lat, point.lon);
};

export const toFacility = (element: OverpassElement): Facility | null => {
	if (element.tags === undefined) {
		return null;
	}
	const position = elementCoordinates(element);
	if (position === null) {
		return null;
	}
	return facilityFromTags({ type: element.type, id: element.id }, position, element.tags);
};

export const toFacilities = (elements: readonly OverpassElement[]): readonly Facility[] =>
	elements.flatMap((element) => {
		const facility = toFacility(element);
		return facility === null ? [] : [facility];
	});
