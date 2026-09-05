/**
 * User-facing copy for the application layer
 */

import type { LayerKind, RefreshError } from './layers';

/**
 * Shown once per zoomed-out stretch when the map is too far out to query facilities
 */
export const ZOOMED_OUT_MESSAGE = 'Zoom in to see water points and toilets';

/**
 * Shown when the viewer's position could not be detected at startup
 */
export const LOCATION_FALLBACK_MESSAGE = 'Could not detect your location. Showing Riga area.';

/**
 * Shown when bootstrapping the map threw
 */
export const INITIALIZATION_FAILED_MESSAGE =
	'An unexpected error occurred while initializing the map. Please refresh the page.';

/**
 * What a layer's facilities are called in messages
 */
export const subjectOf = (kind: LayerKind): string => {
	switch (kind) {
		case 'water':
			return 'water points';
		case 'toilet':
			return 'public toilets';
		default: {
			const exhaustive: never = kind;
			return exhaustive;
		}
	}
};

/**
 * Message for a failed refresh of a layer
 */
export const fetchErrorMessage = (kind: LayerKind, error: RefreshError): string => {
	const subject = subjectOf(kind);
	switch (error.type) {
		case 'network':
			return `Failed to load ${subject}. Please check your internet connection and try again.`;
		case 'timeout':
			return `Request timed out while loading ${subject}. Please try again.`;
		case 'parse':
			return `Failed to read ${subject} data. Please try again.`;
		default: {
			const exhaustive: never = error;
			return exhaustive;
		}
	}
};

/**
 * Message for a viewport without any facility of the given kind
 */
export const emptyAreaMessage = (kind: LayerKind): string => {
	switch (kind) {
		case 'water':
			return 'No water points found in this area. Try zooming out or panning to a different location.';
		case 'toilet':
			return 'No public toilets found in this area.';
		default: {
			const exhaustive: never = kind;
			return exhaustive;
		}
	}
};
