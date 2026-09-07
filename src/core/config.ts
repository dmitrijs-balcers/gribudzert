import type * as L from 'leaflet';
import type { Meters, MetersPerSecond } from '../domain/geo';
import { metersLiteral, metersPerSecondLiteral } from '../domain/geo';
import type { DurationMs, SchemaVersion, Zoom } from '../domain/units';
import { durationMsLiteral, schemaVersionLiteral, zoomLevel } from '../domain/units';

export const RIGA_CENTER: L.LatLngTuple = [56.9496, 24.1052];

export const DEFAULT_ZOOM = 13;

export const MAX_ZOOM = 19;

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const MIN_FETCH_ZOOM: Zoom = zoomLevel(12);

export const FETCH_PADDING_FACTOR = 2;

export const EMPTY_AREA_NOTIFICATION_COOLDOWN_MS: DurationMs = durationMsLiteral(30_000);

export const OSM_ATTRIBUTION =
	'&copy; <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

export const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

export const USER_LOCATION_STYLE = {
	color: '#136AEC',
	fillColor: '#2A93EE',
	fillOpacity: 0.25,
	minRadius: 10,
} as const;

export const LOCATE_ZOOM: Zoom = zoomLevel(15);

export const QUICK_FIX_OPTIONS: PositionOptions = {
	enableHighAccuracy: false,
	maximumAge: 60_000,
	timeout: 5_000,
};

export const WATCH_OPTIONS: PositionOptions = {
	enableHighAccuracy: true,
	maximumAge: 0,
	timeout: 20_000,
};

export const POSITION_STALE_AFTER_MS: DurationMs = durationMsLiteral(30_000);

export const RERANK_MIN_MOVE_M: Meters = metersLiteral(25);

export const ACCURACY_CIRCLE_MAX_M: Meters = metersLiteral(500);

export const MOVING_SPEED_THRESHOLD_MPS: MetersPerSecond = metersPerSecondLiteral(0.5);

export const LAST_POSITION_STORAGE_KEY = 'gribudzert.lastPosition';

export const LAST_POSITION_MAX_AGE_MS: DurationMs = durationMsLiteral(604_800_000);

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

export const FETCH_RETRY_BACKOFF_MS: DurationMs = durationMsLiteral(400);

export const CACHE_WARMUP_TIMEOUT_MS: DurationMs = durationMsLiteral(2_000);

export const TILE_HOSTS: readonly string[] = ['tile.openstreetmap.org'];

export const TILE_CACHE_DB_NAME = 'gribudzert-tiles';

export const TILE_CACHE_SCHEMA_VERSION: SchemaVersion = schemaVersionLiteral(1);

export const TILE_LIFETIME_FLOOR_MS: DurationMs = durationMsLiteral(604_800_000);

export const TILE_MAX_AGE_MS: DurationMs = durationMsLiteral(2_592_000_000);

export const TILE_BUDGET = { maxTiles: 3000, maxBytes: 40_000_000 } as const;

export const TILE_TOUCH_INTERVAL_MS: DurationMs = durationMsLiteral(3_600_000);

export const TILE_EVICTION_EVERY_N_PUTS = 25;

export const SHELL_CACHE_PREFIX = 'gribudzert-shell-';

export const SERVICE_WORKER_PATH = '/sw.js';

export const INSTALL_PROMPT_STORAGE_PREFIX = 'gribudzert:install-prompt';

export const INSTALL_PROMPT_MIN_VISITS = 2;

export const INSTALL_PROMPT_SHOW_DELAY_MS: DurationMs = durationMsLiteral(3_000);

export const INSTALL_PROMPT_DISMISS_COOLDOWN_MS: DurationMs = durationMsLiteral(1_209_600_000);
