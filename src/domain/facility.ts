/**
 * Facility domain model
 * A Facility is a validated, fully classified point of interest (water source or toilet).
 * Raw OpenStreetMap tags never leak past this boundary: consumers read typed fields.
 */

import type { Coordinates } from './geo';
import { coordinates } from './geo';

/**
 * OpenStreetMap element types
 */
export type OsmType = 'node' | 'way' | 'relation';

/**
 * Reference to the OpenStreetMap element a facility was derived from
 */
export type OsmRef = {
	readonly type: OsmType;
	readonly id: number;
};

/**
 * Branded facility identifier, unique across OSM element types (e.g. `node/123`)
 */
export type FacilityId = string & { readonly __brand: 'FacilityId' };

/**
 * Build a FacilityId from an OSM reference
 */
export const facilityId = (osm: OsmRef): FacilityId => `${osm.type}/${osm.id}` as FacilityId;

/**
 * Public OpenStreetMap URL for an OSM reference
 */
export const osmUrl = (osm: OsmRef): string =>
	`https://www.openstreetmap.org/${osm.type}/${osm.id}`;

/**
 * Wheelchair accessibility (`wheelchair=*` tag)
 */
export type WheelchairAccess = 'yes' | 'no' | 'limited' | 'unknown';

/**
 * Tri-state answer for yes/no tags that may be missing
 */
export type YesNoUnknown = 'yes' | 'no' | 'unknown';

/**
 * Kind of water source, derived from the primary OSM tag
 */
export type WaterSourceType =
	| 'drinking_water' // amenity=drinking_water
	| 'spring' // natural=spring
	| 'water_well' // man_made=water_well
	| 'water_tap' // man_made=water_tap
	| 'water_point'; // waterway=water_point

/**
 * Fields shared by every facility
 */
type FacilityBase = {
	readonly id: FacilityId;
	readonly osm: OsmRef;
	readonly coordinates: Coordinates;
	readonly name?: string;
	readonly operator?: string;
	readonly note?: string;
	readonly openingHours?: string;
};

/**
 * Drinking water source
 */
export type WaterFacility = FacilityBase & {
	readonly kind: 'water';
	readonly sourceType: WaterSourceType;
	/** True unless explicitly tagged `drinking_water=no` */
	readonly drinkable: boolean;
	readonly seasonal: boolean;
	readonly bottleRefill: boolean;
	readonly wheelchair: WheelchairAccess;
};

/**
 * Accessibility features of a toilet
 */
export type ToiletAccessibility = {
	readonly wheelchair: WheelchairAccess;
	readonly changingTable: YesNoUnknown;
};

/**
 * Public toilet
 */
export type ToiletFacility = FacilityBase & {
	readonly kind: 'toilet';
	readonly accessibility: ToiletAccessibility;
	readonly fee: YesNoUnknown;
	/** null when the tag is absent */
	readonly unisex: boolean | null;
};

/**
 * Discriminated union of all facility types
 */
export type Facility = WaterFacility | ToiletFacility;

/**
 * Facility discriminator values
 */
export type FacilityKind = Facility['kind'];

/**
 * Type guard for water facilities
 */
export const isWaterFacility = (facility: Facility): facility is WaterFacility =>
	facility.kind === 'water';

/**
 * Type guard for toilet facilities
 */
export const isToiletFacility = (facility: Facility): facility is ToiletFacility =>
	facility.kind === 'toilet';

/**
 * Wheelchair access of any facility (`yes` only counts as accessible)
 */
export const wheelchairAccessOf = (facility: Facility): WheelchairAccess =>
	facility.kind === 'water' ? facility.wheelchair : facility.accessibility.wheelchair;

/**
 * Whether the facility is explicitly wheelchair accessible
 */
export const isWheelchairAccessible = (facility: Facility): boolean =>
	wheelchairAccessOf(facility) === 'yes';

type UnknownRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isOsmType = (value: unknown): value is OsmType =>
	value === 'node' || value === 'way' || value === 'relation';

const parseOsmRef = (value: unknown): OsmRef | null => {
	if (!isRecord(value)) {
		return null;
	}
	const { type, id } = value;
	if (!isOsmType(type) || typeof id !== 'number' || !Number.isFinite(id)) {
		return null;
	}
	return { type, id };
};

const parseCoordinatesField = (value: unknown): Coordinates | null => {
	if (!isRecord(value)) {
		return null;
	}
	const { lat, lon } = value;
	if (typeof lat !== 'number' || typeof lon !== 'number') {
		return null;
	}
	return coordinates(lat, lon);
};

type ParsedOptionalString =
	| { readonly present: false }
	| { readonly present: true; readonly value: string };

const parseOptionalString = (value: unknown): ParsedOptionalString | null => {
	if (value === undefined) {
		return { present: false };
	}
	if (typeof value === 'string') {
		return { present: true, value };
	}
	return null;
};

type ParsedFacilityBase = {
	readonly id: FacilityId;
	readonly osm: OsmRef;
	readonly coordinates: Coordinates;
	readonly name?: string;
	readonly operator?: string;
	readonly note?: string;
	readonly openingHours?: string;
};

const parseFacilityBase = (record: UnknownRecord): ParsedFacilityBase | null => {
	const osm = parseOsmRef(record.osm);
	if (osm === null || record.id !== facilityId(osm)) {
		return null;
	}
	const parsedCoordinates = parseCoordinatesField(record.coordinates);
	if (parsedCoordinates === null) {
		return null;
	}
	const name = parseOptionalString(record.name);
	const operator = parseOptionalString(record.operator);
	const note = parseOptionalString(record.note);
	const openingHours = parseOptionalString(record.openingHours);
	if (name === null || operator === null || note === null || openingHours === null) {
		return null;
	}
	return {
		id: facilityId(osm),
		osm,
		coordinates: parsedCoordinates,
		...(name.present ? { name: name.value } : {}),
		...(operator.present ? { operator: operator.value } : {}),
		...(note.present ? { note: note.value } : {}),
		...(openingHours.present ? { openingHours: openingHours.value } : {}),
	};
};

const isWaterSourceType = (value: unknown): value is WaterSourceType =>
	value === 'drinking_water' ||
	value === 'spring' ||
	value === 'water_well' ||
	value === 'water_tap' ||
	value === 'water_point';

const isWheelchairAccess = (value: unknown): value is WheelchairAccess =>
	value === 'yes' || value === 'no' || value === 'limited' || value === 'unknown';

const isYesNoUnknown = (value: unknown): value is YesNoUnknown =>
	value === 'yes' || value === 'no' || value === 'unknown';

const parseWaterFacility = (record: UnknownRecord): WaterFacility | null => {
	const base = parseFacilityBase(record);
	if (base === null) {
		return null;
	}
	const { sourceType, drinkable, seasonal, bottleRefill, wheelchair } = record;
	if (
		!isWaterSourceType(sourceType) ||
		typeof drinkable !== 'boolean' ||
		typeof seasonal !== 'boolean' ||
		typeof bottleRefill !== 'boolean' ||
		!isWheelchairAccess(wheelchair)
	) {
		return null;
	}
	return { ...base, kind: 'water', sourceType, drinkable, seasonal, bottleRefill, wheelchair };
};

const parseToiletFacility = (record: UnknownRecord): ToiletFacility | null => {
	const base = parseFacilityBase(record);
	if (base === null) {
		return null;
	}
	const accessibility = record.accessibility;
	if (!isRecord(accessibility)) {
		return null;
	}
	const { wheelchair, changingTable } = accessibility;
	if (!isWheelchairAccess(wheelchair) || !isYesNoUnknown(changingTable)) {
		return null;
	}
	const fee = record.fee;
	if (!isYesNoUnknown(fee)) {
		return null;
	}
	const unisex = record.unisex;
	if (unisex !== null && typeof unisex !== 'boolean') {
		return null;
	}
	return {
		...base,
		kind: 'toilet',
		accessibility: { wheelchair, changingTable },
		fee,
		unisex,
	};
};

export const parseFacility = (value: unknown): Facility | null => {
	if (!isRecord(value)) {
		return null;
	}
	switch (value.kind) {
		case 'water':
			return parseWaterFacility(value);
		case 'toilet':
			return parseToiletFacility(value);
		default:
			return null;
	}
};
