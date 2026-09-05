/**
 * OpenStreetMap tag interpretation
 * The single place where raw OSM tags are turned into Facility values.
 * Every tag-reading rule (drinkability, accessibility, fees, ...) lives here.
 */

import type {
	Facility,
	OsmRef,
	ToiletFacility,
	WaterFacility,
	WaterSourceType,
	WheelchairAccess,
	YesNoUnknown,
} from './facility';
import { facilityId } from './facility';
import type { Coordinates } from './geo';

/**
 * Raw OSM tags as returned by the API
 */
export type OsmTags = Readonly<Record<string, string>>;

/**
 * Lower-cased tag value, or undefined when the tag is absent
 */
const tagValue = (tags: OsmTags, key: string): string | undefined => tags[key]?.toLowerCase();

/**
 * Whether a tag is present with the value `yes`
 */
const isYes = (tags: OsmTags, key: string): boolean => tagValue(tags, key) === 'yes';

/**
 * Parse a yes/no tag, defaulting to `unknown`
 */
const parseYesNo = (value: string | undefined): YesNoUnknown => {
	if (value === 'yes') return 'yes';
	if (value === 'no') return 'no';
	return 'unknown';
};

/**
 * Parse a `wheelchair=*` tag, defaulting to `unknown`
 */
const parseWheelchair = (value: string | undefined): WheelchairAccess => {
	if (value === 'yes') return 'yes';
	if (value === 'no') return 'no';
	if (value === 'limited') return 'limited';
	return 'unknown';
};

/**
 * Parse a `unisex=*` tag; null when absent
 */
const parseUnisex = (value: string | undefined): boolean | null => {
	if (value === undefined) return null;
	return value === 'yes';
};

/**
 * Determine the water source type, or null when the tags do not describe a water source
 */
export const waterSourceTypeOf = (tags: OsmTags): WaterSourceType | null => {
	if (tags.amenity === 'drinking_water') return 'drinking_water';
	if (tags.natural === 'spring') return 'spring';
	if (tags.man_made === 'water_well') return 'water_well';
	if (tags.man_made === 'water_tap') return 'water_tap';
	if (tags.waterway === 'water_point') return 'water_point';
	return null;
};

/**
 * Whether the tags describe a public toilet
 */
export const isToiletTags = (tags: OsmTags): boolean => tags.amenity === 'toilets';

/**
 * Water is assumed drinkable unless explicitly tagged `drinking_water=no`
 */
const isDrinkable = (tags: OsmTags): boolean => tagValue(tags, 'drinking_water') !== 'no';

/**
 * Fields shared by all facilities. Optional fields are only present when the tag exists.
 */
const baseFields = (osm: OsmRef, coordinates: Coordinates, tags: OsmTags) => ({
	id: facilityId(osm),
	osm,
	coordinates,
	...(tags.name !== undefined ? { name: tags.name } : {}),
	...(tags.operator !== undefined ? { operator: tags.operator } : {}),
	...(tags.note !== undefined ? { note: tags.note } : {}),
	...(tags.opening_hours !== undefined ? { openingHours: tags.opening_hours } : {}),
});

/**
 * Build a WaterFacility from OSM tags
 */
const waterFacilityFromTags = (
	osm: OsmRef,
	coordinates: Coordinates,
	tags: OsmTags,
	sourceType: WaterSourceType
): WaterFacility => ({
	...baseFields(osm, coordinates, tags),
	kind: 'water',
	sourceType,
	drinkable: isDrinkable(tags),
	seasonal: isYes(tags, 'seasonal'),
	bottleRefill: isYes(tags, 'bottle'),
	wheelchair: parseWheelchair(tagValue(tags, 'wheelchair')),
});

/**
 * Build a ToiletFacility from OSM tags
 */
const toiletFacilityFromTags = (
	osm: OsmRef,
	coordinates: Coordinates,
	tags: OsmTags
): ToiletFacility => ({
	...baseFields(osm, coordinates, tags),
	kind: 'toilet',
	accessibility: {
		wheelchair: parseWheelchair(tagValue(tags, 'wheelchair')),
		changingTable: parseYesNo(tagValue(tags, 'changing_table')),
	},
	fee: parseYesNo(tagValue(tags, 'fee')),
	unisex: parseUnisex(tagValue(tags, 'unisex')),
});

/**
 * Classify OSM tags into a Facility
 * @returns A toilet for `amenity=toilets`, a water facility for any known water tag, otherwise null
 */
export const facilityFromTags = (
	osm: OsmRef,
	coordinates: Coordinates,
	tags: OsmTags
): Facility | null => {
	if (isToiletTags(tags)) {
		return toiletFacilityFromTags(osm, coordinates, tags);
	}

	const sourceType = waterSourceTypeOf(tags);
	if (sourceType !== null) {
		return waterFacilityFromTags(osm, coordinates, tags, sourceType);
	}

	return null;
};
