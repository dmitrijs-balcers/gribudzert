/**
 * Overpass API data boundary
 * Raw wire types for the Overpass JSON output, runtime validation of untrusted
 * responses, and conversion of validated elements into domain Facilities.
 */

import type { Coordinates, Facility, OsmTags } from '../../domain';
import { coordinates, facilityFromTags } from '../../domain';
import type { FetchError } from '../../types/errors';
import type { Result } from '../../types/result';
import { Err, Ok } from '../../types/result';

/**
 * Centre point Overpass attaches to ways/relations when queried with `out center`
 */
export type OverpassCenter = {
	readonly lat: number;
	readonly lon: number;
};

/**
 * Raw tags as returned by Overpass (absent on tag-less member elements)
 */
export type OverpassTags = OsmTags;

/**
 * Node element: always carries its own coordinates
 */
export type OverpassNode = {
	readonly type: 'node';
	readonly id: number;
	readonly lat: number;
	readonly lon: number;
	readonly tags?: OverpassTags;
};

/**
 * Way element: coordinates only via `center`
 */
export type OverpassWay = {
	readonly type: 'way';
	readonly id: number;
	readonly center?: OverpassCenter;
	readonly tags?: OverpassTags;
};

/**
 * Relation element: coordinates only via `center`
 */
export type OverpassRelation = {
	readonly type: 'relation';
	readonly id: number;
	readonly center?: OverpassCenter;
	readonly tags?: OverpassTags;
};

/**
 * Any Overpass element
 */
export type OverpassElement = OverpassNode | OverpassWay | OverpassRelation;

/**
 * The part of the Overpass response envelope we rely on
 */
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

/**
 * Structural type guard for a single Overpass element.
 * Nodes need numeric `lat`/`lon`; ways and relations may carry an optional `center`.
 * `tags`, when present, must be a string-to-string map.
 */
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

/**
 * Validate an Overpass JSON body.
 * A missing or non-array `elements` is a parse error; individual malformed elements are dropped.
 */
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

/**
 * Validated coordinates of an element: its own position for nodes, the centre for ways/relations.
 * Null when absent or out of range.
 */
export const elementCoordinates = (element: OverpassElement): Coordinates | null => {
	const point = element.type === 'node' ? element : element.center;
	return point === undefined ? null : coordinates(point.lat, point.lon);
};

/**
 * Convert one validated element into a Facility.
 * Returns null for elements without tags, without usable coordinates, or with tags that
 * describe neither a water source nor a toilet.
 */
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

/**
 * Convert all convertible elements, silently skipping the rest
 */
export const toFacilities = (elements: readonly OverpassElement[]): readonly Facility[] =>
	elements.flatMap((element) => {
		const facility = toFacility(element);
		return facility === null ? [] : [facility];
	});
