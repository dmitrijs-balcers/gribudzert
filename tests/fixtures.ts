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

export const USER = { lat: 56.955, lon: 24.12, accuracy: 25 } as const;

export const RIGA = { lat: 56.9496, lon: 24.1052 } as const;

export const NEAREST_TAP_TO_USER = {
	type: 'node',
	id: 101,
	lat: 56.954,
	lon: 24.118,
	tags: { amenity: 'drinking_water' },
} as const satisfies OverpassElement;

export const NON_DRINKABLE = {
	type: 'node',
	id: 102,
	lat: 56.9525,
	lon: 24.1125,
	tags: { amenity: 'drinking_water', drinking_water: 'no' },
} as const satisfies OverpassElement;

export const SEASONAL_TAP_NEAR_RIGA_CENTRE = {
	type: 'node',
	id: 103,
	lat: 56.9505,
	lon: 24.104,
	tags: { man_made: 'water_tap', seasonal: 'yes' },
} as const satisfies OverpassElement;

export const TAGLESS_WAY_MEMBER_NODE = {
	type: 'node',
	id: 104,
	lat: 56.951,
	lon: 24.11,
} as const satisfies OverpassElement;

export const WATER_ELEMENTS: readonly OverpassElement[] = [
	NEAREST_TAP_TO_USER,
	NON_DRINKABLE,
	SEASONAL_TAP_NEAR_RIGA_CENTRE,
	TAGLESS_WAY_MEMBER_NODE,
];

const hasTags = (element: OverpassElement): boolean => element.tags !== undefined;

export const WATER_MARKER_COUNT = WATER_ELEMENTS.filter(hasTags).length;

export const ACCESSIBLE_TOILET = {
	type: 'way',
	id: 201,
	center: { lat: 56.9515, lon: 24.115 },
	tags: { amenity: 'toilets', wheelchair: 'yes' },
} as const satisfies OverpassElement;

export const TOILET_ELEMENTS: readonly OverpassElement[] = [ACCESSIBLE_TOILET];

export const isToiletQuery = (query: string): boolean => query.includes('"amenity"="toilets"');

export const isViewpointQuery = (query: string): boolean => query.includes('"tourism"="viewpoint"');

export const BARE_VIEWPOINT = {
	type: 'node',
	id: 301,
	lat: 56.953,
	lon: 24.108,
	tags: { tourism: 'viewpoint' },
} as const satisfies OverpassElement;

export const NAMED_VIEWPOINT = {
	type: 'node',
	id: 302,
	lat: 56.9535,
	lon: 24.1085,
	tags: { tourism: 'viewpoint', name: 'Riverside Overlook' },
} as const satisfies OverpassElement;

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
