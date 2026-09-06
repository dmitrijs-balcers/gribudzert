/**
 * Domain layer public API
 * Import from here rather than from the individual modules.
 */

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
	wheelchairAccessOf,
} from './facility';
export type { Coordinates, LatLon, Latitude, Longitude, Meters } from './geo';
export { coordinates, distanceBetween, formatDistance, latitude, longitude, meters } from './geo';
export type { Located } from './located';
export { findNearest, markNearest, nearestOf, withDistances } from './located';
export type { OsmTags } from './osm';
export { facilityFromTags, isToiletTags, waterSourceTypeOf } from './osm';
export type { TileBounds, TileId } from './tile';
export { boundsOfTiles, parseTileId, tileBounds, tileOf, tilesCovering } from './tile';
