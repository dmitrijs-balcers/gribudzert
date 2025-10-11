/**
 * Application configuration and constants
 */

import type * as L from 'leaflet';

/**
 * Default map center coordinates (Riga, Latvia)
 */
export const RIGA_CENTER: L.LatLngTuple = [56.9496, 24.1052];
export const rigaLatLng: L.LatLngTuple = RIGA_CENTER; // Alias for backward compatibility

/**
 * Default map zoom level
 */
export const DEFAULT_ZOOM = 13;
export const defaultZoom = DEFAULT_ZOOM; // Alias

/**
 * Maximum zoom level for tile layer
 */
export const MAX_ZOOM = 19;
export const maxZoom = MAX_ZOOM; // Alias

/**
 * OpenStreetMap tile layer URL template
 */
export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const tileLayerUrl = OSM_TILE_URL; // Alias

/**
 * OpenStreetMap attribution text
 */
export const OSM_ATTRIBUTION =
	'&copy; <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
export const osmAttribution = OSM_ATTRIBUTION; // Alias

/**
 * Overpass API endpoint URL
 */
export const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
export const overpassApiUrl = OVERPASS_API_URL; // Alias

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
export const colourMap = COLOUR_MAP; // Alias

/**
 * Marker radius configurations
 */
export const MARKER_RADIUS = {
	default: 8,
	bottle: 8,
	wheelchair: 8,
} as const;
export const defaultMarkerRadius = MARKER_RADIUS.default; // Alias

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
export const userLocationColor = USER_LOCATION_STYLE.color; // Alias
export const userLocationFillColor = USER_LOCATION_STYLE.fillColor; // Alias

/**
 * Geolocation options
 */
export const GEOLOCATION_OPTIONS: PositionOptions = {
	enableHighAccuracy: true,
	maximumAge: 0,
	timeout: 10000,
};
export const geolocationOptions = GEOLOCATION_OPTIONS; // Alias

/**
 * Location detection configuration
 */
export const LOCATION_TIMEOUT = 10000; // 10 seconds
export const LOCATION_HIGH_ACCURACY = true;

