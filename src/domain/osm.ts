import type {
	Facility,
	OsmRef,
	ToiletFacility,
	ViewpointFacility,
	ViewpointProminence,
	WaterFacility,
	WaterSourceType,
	WheelchairAccess,
	YesNoUnknown,
} from './facility';
import { facilityId } from './facility';
import type { Coordinates } from './geo';

export type OsmTags = Readonly<Record<string, string>>;

const tagValue = (tags: OsmTags, key: string): string | undefined => tags[key]?.toLowerCase();

const isYes = (tags: OsmTags, key: string): boolean => tagValue(tags, key) === 'yes';

const parseYesNo = (value: string | undefined): YesNoUnknown => {
	if (value === 'yes') return 'yes';
	if (value === 'no') return 'no';
	return 'unknown';
};

const parseWheelchair = (value: string | undefined): WheelchairAccess => {
	if (value === 'yes') return 'yes';
	if (value === 'no') return 'no';
	if (value === 'limited') return 'limited';
	return 'unknown';
};

type WaterSourceTag = {
	readonly sourceType: WaterSourceType;
	readonly key: string;
	readonly value: string;
};

const WATER_SOURCE_TAGS: readonly WaterSourceTag[] = [
	{ sourceType: 'drinking_water', key: 'amenity', value: 'drinking_water' },
	{ sourceType: 'spring', key: 'natural', value: 'spring' },
	{ sourceType: 'water_well', key: 'man_made', value: 'water_well' },
	{ sourceType: 'water_tap', key: 'man_made', value: 'water_tap' },
	{ sourceType: 'water_point', key: 'waterway', value: 'water_point' },
];

export const waterSourceTypeOf = (tags: OsmTags): WaterSourceType | null =>
	WATER_SOURCE_TAGS.find(({ key, value }) => tags[key] === value)?.sourceType ?? null;

export const isToiletTags = (tags: OsmTags): boolean => tags.amenity === 'toilets';

export const isViewpointTags = (tags: OsmTags): boolean => tags.tourism === 'viewpoint';

const hasPhotoOrArticle = (tags: OsmTags): boolean =>
	tags.image !== undefined ||
	tags.wikimedia_commons !== undefined ||
	tags.wikipedia !== undefined ||
	tags.wikidata !== undefined;

const hasNameOrDescription = (tags: OsmTags): boolean =>
	tags.name !== undefined || tags.description !== undefined;

export const viewpointProminenceOf = (tags: OsmTags): ViewpointProminence => {
	if (hasPhotoOrArticle(tags)) {
		return 'notable';
	}
	if (hasNameOrDescription(tags)) {
		return 'named';
	}
	return 'bare';
};

const UNDRINKABLE_TAG_VALUE = 'no';

const isDrinkable = (tags: OsmTags): boolean =>
	tagValue(tags, 'drinking_water') !== UNDRINKABLE_TAG_VALUE;

const parseElevation = (value: string | undefined): number | undefined => {
	if (value === undefined) {
		return undefined;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const baseFields = (osm: OsmRef, coordinates: Coordinates, tags: OsmTags) => ({
	id: facilityId(osm),
	osm,
	coordinates,
	...(tags.name !== undefined ? { name: tags.name } : {}),
	...(tags.operator !== undefined ? { operator: tags.operator } : {}),
	...(tags.note !== undefined ? { note: tags.note } : {}),
	...(tags.opening_hours !== undefined ? { openingHours: tags.opening_hours } : {}),
});

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
	unisex: parseYesNo(tagValue(tags, 'unisex')),
});

const viewpointFacilityFromTags = (
	osm: OsmRef,
	coordinates: Coordinates,
	tags: OsmTags
): ViewpointFacility => {
	const elevation = parseElevation(tags.ele);
	return {
		...baseFields(osm, coordinates, tags),
		kind: 'viewpoint',
		prominence: viewpointProminenceOf(tags),
		...(tags.description !== undefined ? { description: tags.description } : {}),
		...(elevation !== undefined ? { elevation } : {}),
	};
};

export const facilityFromTags = (
	osm: OsmRef,
	coordinates: Coordinates,
	tags: OsmTags
): Facility | null => {
	if (isToiletTags(tags)) {
		return toiletFacilityFromTags(osm, coordinates, tags);
	}

	if (isViewpointTags(tags)) {
		return viewpointFacilityFromTags(osm, coordinates, tags);
	}

	const sourceType = waterSourceTypeOf(tags);
	if (sourceType !== null) {
		return waterFacilityFromTags(osm, coordinates, tags, sourceType);
	}

	return null;
};
