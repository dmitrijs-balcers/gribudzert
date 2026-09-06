export type {
	Facility,
	FacilityId,
	FacilityKind,
	OsmRef,
	OsmType,
	ToiletAccessibility,
	ToiletFacility,
	WaterFacility,
	WaterSourceType,
	WheelchairAccess,
	YesNoUnknown,
} from './facility';
export {
	facilityId,
	isToiletFacility,
	isWaterFacility,
	isWheelchairAccessible,
	osmUrl,
	parseFacility,
	wheelchairAccessOf,
} from './facility';
export type {
	Coordinates,
	CompassPoint,
	Heading,
	LatLon,
	Latitude,
	Longitude,
	Meters,
	MetersPerSecond,
} from './geo';
export {
	bearingBetween,
	compassPointOf,
	coordinates,
	distanceBetween,
	formatDistance,
	heading,
	latitude,
	longitude,
	meters,
	metersPerSecond,
} from './geo';
export type { Located } from './located';
export { findNearest, markNearest, nearestOf, withDistances } from './located';
export type { UserPosition } from './position';
export { isMoving, toUserPosition } from './position';
export type { OsmTags } from './osm';
export { facilityFromTags, isToiletTags, waterSourceTypeOf } from './osm';
export type { TileBounds, TileId } from './tile';
export { boundsOfTiles, parseTileId, tileBounds, tileOf, tilesCovering } from './tile';
export type { DurationMs, SchemaVersion, Timestamp, Zoom, ZoomLevelLiteral } from './units';
export {
	durationMs,
	durationMsLiteral,
	entriesOf,
	keysOf,
	schemaVersionLiteral,
	timestamp,
	timestampNow,
	zoom,
	zoomLevel,
} from './units';
