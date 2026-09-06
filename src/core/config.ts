import type * as L from 'leaflet';
import type { DurationMs, SchemaVersion, Zoom } from '../domain/units';
import { durationMsLiteral, schemaVersionLiteral, zoomLevel } from '../domain/units';

export const RIGA_CENTER: L.LatLngTuple = [56.9496, 24.1052];

export const DEFAULT_ZOOM = 13;

export const MAX_ZOOM = 19;

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const MIN_FETCH_ZOOM: Zoom = zoomLevel(12);

export const FETCH_PADDING_FACTOR = 2;

export const EMPTY_AREA_NOTIFICATION_COOLDOWN_MS = 30_000;

export const OSM_ATTRIBUTION =
	'&copy; <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

export const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

export const USER_LOCATION_STYLE = {
	color: '#136AEC',
	fillColor: '#2A93EE',
	fillOpacity: 0.25,
	minRadius: 10,
} as const;

export const GEOLOCATION_OPTIONS: PositionOptions = {
	enableHighAccuracy: true,
	maximumAge: 0,
	timeout: 10000,
};

export const LOCATION_TIMEOUT = 10000;
export const LOCATION_HIGH_ACCURACY = true;

export const LAYER_NAMES = {
	WATER: 'Drinking Points',
	TOILET: 'Public Toilets',
} as const;

export type LayerName = (typeof LAYER_NAMES)[keyof typeof LAYER_NAMES];

export const CACHE_TILE_ZOOM: Zoom = zoomLevel(13);

export const FACILITY_CACHE_TTL_MS: DurationMs = durationMsLiteral(86_400_000);

export const FACILITY_CACHE_MAX_TILES = 400;

export const FACILITY_CACHE_DB_NAME = 'gribudzert';

export const FACILITY_CACHE_SCHEMA_VERSION: SchemaVersion = schemaVersionLiteral(1);
