/**
 * Facility domain model
 * A Facility is a validated, fully classified point of interest (water source or toilet).
 * Raw OpenStreetMap tags never leak past this boundary: consumers read typed fields.
 */

import type { Coordinates } from './geo';

/**
 * OpenStreetMap element types
 */
export type OsmType = 'node' | 'way' | 'relation';

/**
 * Reference to the OpenStreetMap element a facility was derived from
 */
export type OsmRef = {
	readonly type: OsmType;
	readonly id: number;
};

/**
 * Branded facility identifier, unique across OSM element types (e.g. `node/123`)
 */
export type FacilityId = string & { readonly __brand: 'FacilityId' };

/**
 * Build a FacilityId from an OSM reference
 */
export const facilityId = (osm: OsmRef): FacilityId => `${osm.type}/${osm.id}` as FacilityId;

/**
 * Public OpenStreetMap URL for an OSM reference
 */
export const osmUrl = (osm: OsmRef): string =>
	`https://www.openstreetmap.org/${osm.type}/${osm.id}`;

/**
 * Wheelchair accessibility (`wheelchair=*` tag)
 */
export type WheelchairAccess = 'yes' | 'no' | 'limited' | 'unknown';

/**
 * Tri-state answer for yes/no tags that may be missing
 */
export type YesNoUnknown = 'yes' | 'no' | 'unknown';

/**
 * Kind of water source, derived from the primary OSM tag
 */
export type WaterSourceType =
	| 'drinking_water' // amenity=drinking_water
	| 'spring' // natural=spring
	| 'water_well' // man_made=water_well
	| 'water_tap' // man_made=water_tap
	| 'water_point'; // waterway=water_point

/**
 * Fields shared by every facility
 */
type FacilityBase = {
	readonly id: FacilityId;
	readonly osm: OsmRef;
	readonly coordinates: Coordinates;
	readonly name?: string;
	readonly operator?: string;
	readonly note?: string;
	readonly openingHours?: string;
};

/**
 * Drinking water source
 */
export type WaterFacility = FacilityBase & {
	readonly kind: 'water';
	readonly sourceType: WaterSourceType;
	/** True unless explicitly tagged `drinking_water=no` */
	readonly drinkable: boolean;
	readonly seasonal: boolean;
	readonly bottleRefill: boolean;
	readonly wheelchair: WheelchairAccess;
};

/**
 * Accessibility features of a toilet
 */
export type ToiletAccessibility = {
	readonly wheelchair: WheelchairAccess;
	readonly changingTable: YesNoUnknown;
};

/**
 * Public toilet
 */
export type ToiletFacility = FacilityBase & {
	readonly kind: 'toilet';
	readonly accessibility: ToiletAccessibility;
	readonly fee: YesNoUnknown;
	/** null when the tag is absent */
	readonly unisex: boolean | null;
};

/**
 * Discriminated union of all facility types
 */
export type Facility = WaterFacility | ToiletFacility;

/**
 * Facility discriminator values
 */
export type FacilityKind = Facility['kind'];

/**
 * Type guard for water facilities
 */
export const isWaterFacility = (facility: Facility): facility is WaterFacility =>
	facility.kind === 'water';

/**
 * Type guard for toilet facilities
 */
export const isToiletFacility = (facility: Facility): facility is ToiletFacility =>
	facility.kind === 'toilet';

/**
 * Wheelchair access of any facility (`yes` only counts as accessible)
 */
export const wheelchairAccessOf = (facility: Facility): WheelchairAccess =>
	facility.kind === 'water' ? facility.wheelchair : facility.accessibility.wheelchair;

/**
 * Whether the facility is explicitly wheelchair accessible
 */
export const isWheelchairAccessible = (facility: Facility): boolean =>
	wheelchairAccessOf(facility) === 'yes';
