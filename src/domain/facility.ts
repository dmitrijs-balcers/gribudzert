import type { Coordinates } from './geo';
import { coordinates } from './geo';

export type OsmType = 'node' | 'way' | 'relation';

export type OsmRef = {
	readonly type: OsmType;
	readonly id: number;
};

export type FacilityId = string & { readonly __brand: 'FacilityId' };

export const facilityId = (osm: OsmRef): FacilityId => `${osm.type}/${osm.id}` as FacilityId;

export const osmUrl = (osm: OsmRef): string =>
	`https://www.openstreetmap.org/${osm.type}/${osm.id}`;

export type WheelchairAccess = 'yes' | 'no' | 'limited' | 'unknown';

export type YesNoUnknown = 'yes' | 'no' | 'unknown';

export type WaterSourceType =
	| 'drinking_water'
	| 'spring'
	| 'water_well'
	| 'water_tap'
	| 'water_point';

export type ExternalLinkKind = 'wikipedia' | 'wikidata' | 'website' | 'commons' | 'photo';

export type ExternalLink = {
	readonly kind: ExternalLinkKind;
	readonly url: string;
	readonly label: string;
};

export type Photo = {
	readonly thumbnailUrl: string;
	readonly pageUrl: string;
};

export type FacilityMedia = {
	readonly links: readonly ExternalLink[];
	readonly photo: Photo | null;
};

export const NO_MEDIA: FacilityMedia = { links: [], photo: null };

export type FacilityBase = {
	readonly id: FacilityId;
	readonly osm: OsmRef;
	readonly coordinates: Coordinates;
	readonly name?: string;
	readonly operator?: string;
	readonly note?: string;
	readonly openingHours?: string;
	readonly media: FacilityMedia;
};

export type WaterFacility = FacilityBase & {
	readonly kind: 'water';
	readonly sourceType: WaterSourceType;
	readonly drinkable: boolean;
	readonly seasonal: boolean;
	readonly bottleRefill: boolean;
	readonly wheelchair: WheelchairAccess;
};

export type ToiletAccessibility = {
	readonly wheelchair: WheelchairAccess;
	readonly changingTable: YesNoUnknown;
};

export type ToiletFacility = FacilityBase & {
	readonly kind: 'toilet';
	readonly accessibility: ToiletAccessibility;
	readonly fee: YesNoUnknown;
	readonly unisex: YesNoUnknown;
};

export type ViewpointProminence = 'bare' | 'named' | 'notable';

export type ViewpointFacility = FacilityBase & {
	readonly kind: 'viewpoint';
	readonly prominence: ViewpointProminence;
	readonly description?: string;
	readonly elevation?: number;
};

export type Facility = WaterFacility | ToiletFacility | ViewpointFacility;

export type FacilityKind = Facility['kind'];

export const isWaterFacility = (facility: Facility): facility is WaterFacility =>
	facility.kind === 'water';

export const isToiletFacility = (facility: Facility): facility is ToiletFacility =>
	facility.kind === 'toilet';

export const isViewpointFacility = (facility: Facility): facility is ViewpointFacility =>
	facility.kind === 'viewpoint';

export const wheelchairAccessOf = (facility: Facility): WheelchairAccess => {
	switch (facility.kind) {
		case 'water':
			return facility.wheelchair;
		case 'toilet':
			return facility.accessibility.wheelchair;
		case 'viewpoint':
			return 'unknown';
		default: {
			const exhaustive: never = facility;
			return exhaustive;
		}
	}
};

export const isWheelchairAccessible = (facility: Facility): boolean =>
	wheelchairAccessOf(facility) === 'yes';

type UnknownRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isOsmType = (value: unknown): value is OsmType =>
	value === 'node' || value === 'way' || value === 'relation';

const parseString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const parseFiniteNumber = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value) ? value : null;

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

type Parsed<T> = { readonly present: false } | { readonly present: true; readonly value: T };

const parseOptional = <T>(
	value: unknown,
	parse: (value: unknown) => T | null
): Parsed<T> | null => {
	if (value === undefined) {
		return { present: false };
	}
	const parsed = parse(value);
	return parsed === null ? null : { present: true, value: parsed };
};

const isExternalLinkKind = (value: unknown): value is ExternalLinkKind =>
	value === 'wikipedia' ||
	value === 'wikidata' ||
	value === 'website' ||
	value === 'commons' ||
	value === 'photo';

const parseExternalLink = (value: unknown): ExternalLink | null => {
	if (!isRecord(value)) {
		return null;
	}
	const { kind, url, label } = value;
	if (!isExternalLinkKind(kind) || typeof url !== 'string' || typeof label !== 'string') {
		return null;
	}
	return { kind, url, label };
};

const isExternalLink = (link: ExternalLink | null): link is ExternalLink => link !== null;

const parseLinks = (value: unknown): readonly ExternalLink[] | null => {
	if (!Array.isArray(value)) {
		return null;
	}
	const links = value.map(parseExternalLink);
	return links.every(isExternalLink) ? links : null;
};

const parsePhoto = (value: unknown): Photo | null => {
	if (!isRecord(value)) {
		return null;
	}
	const { thumbnailUrl, pageUrl } = value;
	if (typeof thumbnailUrl !== 'string' || typeof pageUrl !== 'string') {
		return null;
	}
	return { thumbnailUrl, pageUrl };
};

export const parseMedia = (value: unknown): FacilityMedia | null => {
	if (!isRecord(value)) {
		return null;
	}
	const links = parseLinks(value.links);
	if (links === null) {
		return null;
	}
	if (value.photo === null) {
		return { links, photo: null };
	}
	const photo = parsePhoto(value.photo);
	return photo === null ? null : { links, photo };
};

const parseFacilityBase = (record: UnknownRecord): FacilityBase | null => {
	const osm = parseOsmRef(record.osm);
	if (osm === null || record.id !== facilityId(osm)) {
		return null;
	}
	const parsedCoordinates = parseCoordinatesField(record.coordinates);
	if (parsedCoordinates === null) {
		return null;
	}
	const name = parseOptional(record.name, parseString);
	const operator = parseOptional(record.operator, parseString);
	const note = parseOptional(record.note, parseString);
	const openingHours = parseOptional(record.openingHours, parseString);
	const media = parseOptional(record.media, parseMedia);
	if (
		name === null ||
		operator === null ||
		note === null ||
		openingHours === null ||
		media === null
	) {
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
		media: media.present ? media.value : NO_MEDIA,
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

const isViewpointProminence = (value: unknown): value is ViewpointProminence =>
	value === 'bare' || value === 'named' || value === 'notable';

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
	if (!isYesNoUnknown(unisex)) {
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

const parseViewpointFacility = (record: UnknownRecord): ViewpointFacility | null => {
	const base = parseFacilityBase(record);
	if (base === null) {
		return null;
	}
	if (!isViewpointProminence(record.prominence)) {
		return null;
	}
	const description = parseOptional(record.description, parseString);
	const elevation = parseOptional(record.elevation, parseFiniteNumber);
	if (description === null || elevation === null) {
		return null;
	}
	return {
		...base,
		kind: 'viewpoint',
		prominence: record.prominence,
		...(description.present ? { description: description.value } : {}),
		...(elevation.present ? { elevation: elevation.value } : {}),
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
		case 'viewpoint':
			return parseViewpointFacility(value);
		default:
			return null;
	}
};
