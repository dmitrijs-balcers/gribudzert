/**
 * Overpass wire-format fixtures and the places the scenarios happen at.
 * Shapes follow the Overpass JSON output, not any application type.
 */

/**
 * Overpass element as returned by the API (`out center` for ways/relations)
 */
export type OverpassElement =
	| {
			readonly type: 'node';
			readonly id: number;
			readonly lat: number;
			readonly lon: number;
			readonly tags?: Readonly<Record<string, string>>;
	  }
	| {
			readonly type: 'way' | 'relation';
			readonly id: number;
			readonly center?: { readonly lat: number; readonly lon: number };
			readonly tags?: Readonly<Record<string, string>>;
	  };

/**
 * Where the viewer is standing in the scenarios (north-east of the Riga default centre)
 */
export const USER = { lat: 56.955, lon: 24.12, accuracy: 25 } as const;

/**
 * Where the app centres the map when the viewer's position is unknown (Riga)
 */
export const RIGA = { lat: 56.9496, lon: 24.1052 } as const;

/**
 * A tap right next to the viewer: nearest water point when location is granted
 */
export const NEAREST_TO_USER = {
	type: 'node',
	id: 101,
	lat: 56.954,
	lon: 24.118,
	tags: { amenity: 'drinking_water' },
} as const satisfies OverpassElement;

/**
 * A source explicitly tagged as not drinkable
 */
export const NON_DRINKABLE = {
	type: 'node',
	id: 102,
	lat: 56.9525,
	lon: 24.1125,
	tags: { amenity: 'drinking_water', drinking_water: 'no' },
} as const satisfies OverpassElement;

/**
 * A seasonal tap by the Riga centre: nearest water point when location is denied
 */
export const SEASONAL_TAP = {
	type: 'node',
	id: 103,
	lat: 56.9505,
	lon: 24.104,
	tags: { man_made: 'water_tap', seasonal: 'yes' },
} as const satisfies OverpassElement;

/**
 * A node without tags, as Overpass returns for members of ways; must be ignored
 */
export const TAGLESS_NODE = {
	type: 'node',
	id: 104,
	lat: 56.951,
	lon: 24.11,
} as const satisfies OverpassElement;

/**
 * Everything the water query returns around Riga
 */
export const WATER_ELEMENTS: readonly OverpassElement[] = [
	NEAREST_TO_USER,
	NON_DRINKABLE,
	SEASONAL_TAP,
	TAGLESS_NODE,
];

/**
 * Number of water markers the viewer sees for WATER_ELEMENTS (the tag-less node is skipped)
 */
export const WATER_MARKER_COUNT = 3;

/**
 * A wheelchair-accessible toilet building (a way with a centre point)
 */
export const ACCESSIBLE_TOILET = {
	type: 'way',
	id: 201,
	center: { lat: 56.9515, lon: 24.115 },
	tags: { amenity: 'toilets', wheelchair: 'yes' },
} as const satisfies OverpassElement;

export const TOILET_ELEMENTS: readonly OverpassElement[] = [ACCESSIBLE_TOILET];

/**
 * Whether an Overpass query asks for toilets rather than water
 */
export const isToiletQuery = (query: string): boolean => query.includes('"amenity"="toilets"');

/**
 * Whether an Overpass query asks for viewpoints
 */
export const isViewpointQuery = (query: string): boolean => query.includes('"tourism"="viewpoint"');

/**
 * A bare viewpoint: no name, description, or media tags at all
 */
export const BARE_VIEWPOINT = {
	type: 'node',
	id: 301,
	lat: 56.953,
	lon: 24.108,
	tags: { tourism: 'viewpoint' },
} as const satisfies OverpassElement;

/**
 * A named viewpoint: has a name, nothing more
 */
export const NAMED_VIEWPOINT = {
	type: 'node',
	id: 302,
	lat: 56.9535,
	lon: 24.1085,
	tags: { tourism: 'viewpoint', name: 'Riverside Overlook' },
} as const satisfies OverpassElement;

/**
 * A notable viewpoint: carries a Wikipedia article, elevation and a description
 */
export const NOTABLE_VIEWPOINT = {
	type: 'node',
	id: 303,
	lat: 56.954,
	lon: 24.109,
	tags: {
		tourism: 'viewpoint',
		name: 'Cathedral Hill',
		description: 'Panoramic view over the old town',
		wikipedia: 'en:Cathedral Hill',
		ele: '42',
	},
} as const satisfies OverpassElement;

export const VIEWPOINT_ELEMENTS: readonly OverpassElement[] = [
	BARE_VIEWPOINT,
	NAMED_VIEWPOINT,
	NOTABLE_VIEWPOINT,
];

/**
 * Water nodes placed at the centre of a bounding box, for areas the viewer pans to
 */
export const waterNodesAt = (
	center: { readonly lat: number; readonly lon: number },
	ids: readonly number[]
): readonly OverpassElement[] =>
	ids.map((id, index) => ({
		type: 'node',
		id,
		lat: center.lat + index * 0.001,
		lon: center.lon + index * 0.001,
		tags: { amenity: 'drinking_water' },
	}));
