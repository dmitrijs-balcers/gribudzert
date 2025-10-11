/**
 * API Contract: Data Transformers
 *
 * Functions to transform Overpass elements into Facility types
 */

import type { Element } from '../../../src/types/overpass';
import type {
  Facility,
  WaterFacility,
  ToiletFacility,
  WaterSourceType,
  ToiletAccessibility,
  ToiletDetails,
  WheelchairAccess,
  ChangingTable,
  FeeStatus,
} from './facilities';

/**
 * Transform Overpass element to WaterFacility
 */
export function elementToWaterFacility(element: Element): WaterFacility {
  return {
    kind: 'water',
    element,
    drinkable: isDrinkable(element),
    sourceType: getWaterSourceType(element),
  };
}

/**
 * Transform Overpass element to ToiletFacility
 */
export function elementToToiletFacility(element: Element): ToiletFacility {
  return {
    kind: 'toilet',
    element,
    accessibility: extractAccessibility(element),
    details: extractToiletDetails(element),
  };
}

/**
 * Check if water source is drinkable
 */
function isDrinkable(element: Element): boolean {
  const drinkingWater = (element.tags.drinking_water || '').toLowerCase();

  // Explicit "no" means not drinkable
  if (drinkingWater === 'no') {
    return false;
  }

  // amenity=drinking_water is assumed drinkable unless tagged otherwise
  if (element.tags.amenity === 'drinking_water') {
    return true;
  }

  // For other water sources, assume drinkable if not explicitly marked
  return drinkingWater !== 'no';
}

/**
 * Determine water source type from tags
 */
function getWaterSourceType(element: Element): WaterSourceType {
  if (element.tags.amenity === 'drinking_water') return 'drinking_water';
  if (element.tags.natural === 'spring') return 'spring';
  if (element.tags.man_made === 'water_well') return 'water_well';
  if (element.tags.man_made === 'water_tap') return 'water_tap';
  if (element.tags.waterway === 'water_point') return 'water_point';
  return 'unknown';
}

/**
 * Extract accessibility information from toilet tags
 */
function extractAccessibility(element: Element): ToiletAccessibility {
  return {
    wheelchair: parseWheelchairTag(element.tags.wheelchair),
    changingTable: parseChangingTableTag(element.tags.changing_table),
  };
}

/**
 * Extract toilet details from tags
 */
function extractToiletDetails(element: Element): ToiletDetails {
  return {
    fee: parseFeeTag(element.tags.fee),
    openingHours: element.tags.opening_hours || null,
    unisex: parseUnisexTag(element.tags.unisex),
  };
}

/**
 * Parse wheelchair tag with fallback to unknown
 */
function parseWheelchairTag(value: string | undefined): WheelchairAccess {
  if (!value) return 'unknown';
  const normalized = value.toLowerCase();
  if (normalized === 'yes') return 'yes';
  if (normalized === 'no') return 'no';
  if (normalized === 'limited') return 'limited';
  return 'unknown';
}

/**
 * Parse changing_table tag with fallback to unknown
 */
function parseChangingTableTag(value: string | undefined): ChangingTable {
  if (!value) return 'unknown';
  const normalized = value.toLowerCase();
  if (normalized === 'yes') return 'yes';
  if (normalized === 'no') return 'no';
  return 'unknown';
}

/**
 * Parse fee tag with fallback to unknown
 */
function parseFeeTag(value: string | undefined): FeeStatus {
  if (!value) return 'unknown';
  const normalized = value.toLowerCase();
  if (normalized === 'yes') return 'yes';
  if (normalized === 'no') return 'no';
  return 'unknown';
}

/**
 * Parse unisex tag (null if not specified)
 */
function parseUnisexTag(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return normalized === 'yes';
}
/**
 * API Contract: Facility Types
 *
 * Discriminated union types for water and toilet facilities
 */

import type { Element } from '../../../src/types/overpass';

/**
 * Discriminated union for all facility types
 */
export type Facility =
  | WaterFacility
  | ToiletFacility;

/**
 * Water source facility
 */
export type WaterFacility = {
  readonly kind: 'water';
  readonly element: Element;
  readonly drinkable: boolean;
  readonly sourceType: WaterSourceType;
};

/**
 * Public toilet facility
 */
export type ToiletFacility = {
  readonly kind: 'toilet';
  readonly element: Element;
  readonly accessibility: ToiletAccessibility;
  readonly details: ToiletDetails;
};

/**
 * Water source categorization
 */
export type WaterSourceType =
  | 'drinking_water'  // amenity=drinking_water
  | 'spring'          // natural=spring
  | 'water_well'      // man_made=water_well
  | 'water_tap'       // man_made=water_tap
  | 'water_point'     // waterway=water_point
  | 'unknown';

/**
 * Toilet accessibility features
 */
export type ToiletAccessibility = {
  readonly wheelchair: WheelchairAccess;
  readonly changingTable: ChangingTable;
};

export type WheelchairAccess = 'yes' | 'no' | 'limited' | 'unknown';
export type ChangingTable = 'yes' | 'no' | 'unknown';

/**
 * Additional toilet details
 */
export type ToiletDetails = {
  readonly fee: FeeStatus;
  readonly openingHours: string | null;
  readonly unisex: boolean | null;
};

export type FeeStatus = 'yes' | 'no' | 'unknown';

/**
 * Type guards
 */
export function isWaterFacility(facility: Facility): facility is WaterFacility {
  return facility.kind === 'water';
}

export function isToiletFacility(facility: Facility): facility is ToiletFacility {
  return facility.kind === 'toilet';
}

/**
 * Helper: Check if toilet is wheelchair accessible
 */
export function isAccessible(accessibility: ToiletAccessibility): boolean {
  return accessibility.wheelchair === 'yes';
}

