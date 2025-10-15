/**
 * Facility Type Definitions
 * Discriminated union types for different facility types (water sources, toilets)
 */

import type { Element } from '../overpass';

/**
 * Discriminated union for all facility types
 */
export type Facility = WaterFacility | ToiletFacility;

/**
 * Water facility (drinking water, spring, well, etc.)
 */
export type WaterFacility = {
	readonly kind: 'water';
	readonly element: Element;
	readonly drinkable: boolean;
	readonly sourceType: WaterSourceType;
};

/**
 * Toilet facility (public toilets)
 */
export type ToiletFacility = {
	readonly kind: 'toilet';
	readonly element: Element;
	readonly accessibility: ToiletAccessibility;
	readonly details: ToiletDetails;
};

/**
 * Water source types
 */
export type WaterSourceType =
	| 'drinking_water' // amenity=drinking_water
	| 'spring' // natural=spring
	| 'water_well' // man_made=water_well
	| 'water_tap' // man_made=water_tap
	| 'water_point' // waterway=water_point
	| 'unknown';

/**
 * Wheelchair accessibility status
 */
export type WheelchairAccess = 'yes' | 'no' | 'limited' | 'unknown';

/**
 * Changing table availability
 */
export type ChangingTable = 'yes' | 'no' | 'unknown';

/**
 * Fee status
 */
export type FeeStatus = 'yes' | 'no' | 'unknown';

/**
 * Toilet accessibility features
 */
export type ToiletAccessibility = {
	readonly wheelchair: WheelchairAccess;
	readonly changingTable: ChangingTable;
};

/**
 * Additional toilet details
 */
export type ToiletDetails = {
	readonly fee: FeeStatus;
	readonly openingHours: string | null; // null if not specified (assume 24/7)
	readonly unisex: boolean | null; // null if not specified
};
