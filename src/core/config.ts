/**
 * Application configuration and constants
 */

import type * as L from 'leaflet';

/**
 * Default map center coordinates (Riga, Latvia)
 */
export const RIGA_CENTER: L.LatLngTuple = [56.9496, 24.1052];

/**
 * Default map zoom level
 */
export const DEFAULT_ZOOM = 13;

/**
 * Maximum zoom level for tile layer
 */
export const MAX_ZOOM = 19;

/**
 * OpenStreetMap tile layer URL template
 */
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Minimum zoom level at which facilities are fetched.
 * Below this the visible area is too large for a useful Overpass query, so requests are skipped.
 */
export const MIN_FETCH_ZOOM = 12;

/**
 * How much larger than the visible viewport the area fetched from Overpass is: 1 fetches
 * exactly the viewport, 2 fetches an area twice as wide and twice as tall, centered on the
 * viewport. The public Overpass API only grants 2 request slots per IP, and every
 * significant pan or zoom used to trigger a fresh request for exactly the visible bounds;
 * padding the fetched area lets panning and zooming within it reuse already-loaded data
 * instead of exhausting those slots.
 */
export const FETCH_PADDING_FACTOR = 2;

/**
 * Minimum interval between two "nothing found here" notifications for the same layer kind
 */
export const EMPTY_AREA_NOTIFICATION_COOLDOWN_MS = 30_000;

/**
 * OpenStreetMap attribution text
 */
export const OSM_ATTRIBUTION =
	'&copy; <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

/**
 * Overpass API endpoint URL
 */
export const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

/**
 * Colour mapping for water tap markers based on 'colour' tag
 */
export const COLOUR_MAP: Record<string, string> = {
	teal: '#2A93EE',
	blue: '#1E90FF',
	red: '#E53935',
	beige: '#D7C7A1',
	default: '#0078ff',
} as const;

/**
 * Marker radius configurations
 */
export const MARKER_RADIUS = {
	default: 8,
	bottle: 8,
	wheelchair: 8,
} as const;

/**
 * Marker style configurations
 */
export const MARKER_STYLE = {
	color: '#333',
	weight: 1,
	fillOpacity: {
		normal: 0.75,
		seasonal: 0.35,
	},
} as const;

/**
 * User location style configuration
 */
export const USER_LOCATION_STYLE = {
	color: '#136AEC',
	fillColor: '#2A93EE',
	fillOpacity: 0.25,
	minRadius: 10,
} as const;

/**
 * Geolocation options
 */
export const GEOLOCATION_OPTIONS: PositionOptions = {
	enableHighAccuracy: true,
	maximumAge: 0,
	timeout: 10000,
};

/**
 * Location detection configuration
 */
export const LOCATION_TIMEOUT = 10000; // 10 seconds
export const LOCATION_HIGH_ACCURACY = true;

/**
 * Layer name constants
 * Used by both UI layer controls and analytics tracking
 * Single source of truth - update here to change everywhere
 */
export const LAYER_NAMES = {
	WATER: 'Drinking Points',
	TOILET: 'Public Toilets',
} as const;

/**
 * LayerName type derived from LAYER_NAMES constant
 * Ensures type safety between UI and analytics
 */
export type LayerName = (typeof LAYER_NAMES)[keyof typeof LAYER_NAMES];
