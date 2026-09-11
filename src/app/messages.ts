import type { LocationError } from '../types/errors';
import type { LayerKind, UserFacingFetchError } from './layers';

export const ZOOMED_OUT_MESSAGE = 'Zoom in to see water points and toilets';

export const LOCATION_FALLBACK_MESSAGE = 'Could not detect your location. Showing Riga area.';

export const GUIDANCE_WAITING_FOR_LOCATION_MESSAGE =
	'Guidance will start once your location is found.';

export const UPDATE_READY_MESSAGE = 'A new version is ready.';

export const UPDATE_RELOAD_ACTION_LABEL = 'Reload';

export const OFFLINE_SHOWING_SAVED_MESSAGE = "Couldn't refresh map data. Showing saved points.";

export const OFFLINE_STATUS_MESSAGE = 'Offline · showing saved points';

export const BACK_ONLINE_MESSAGE = 'Back online.';

export const INITIALIZATION_FAILED_MESSAGE =
	'An unexpected error occurred while initializing the map. Please refresh the page.';

export const INITIALIZATION_REFRESH_ACTION_LABEL = 'Refresh';

export const subjectOf = (kind: LayerKind): string => {
	switch (kind) {
		case 'water':
			return 'water points';
		case 'toilet':
			return 'public toilets';
		case 'viewpoint':
			return 'viewpoints';
		default: {
			const exhaustive: never = kind;
			return exhaustive;
		}
	}
};

export const fetchErrorMessage = (kind: LayerKind, error: UserFacingFetchError): string => {
	const subject = subjectOf(kind);
	switch (error.type) {
		case 'network':
			return `Failed to load ${subject}. Please check your internet connection and try again.`;
		case 'timeout':
			return `Request timed out while loading ${subject}. Please try again.`;
		case 'parse':
			return `Failed to read ${subject} data. Please try again.`;
		case 'busy':
			return 'The map data service is busy right now. Please wait a moment and try again.';
		default: {
			const exhaustive: never = error;
			return exhaustive;
		}
	}
};

export const locationErrorMessage = (error: LocationError): string => {
	switch (error.type) {
		case 'permission-denied':
			return 'Permission to access location was denied. Check your browser site settings and allow location access.';
		case 'position-unavailable':
			return 'Location information is unavailable.';
		case 'timeout':
			return 'Location request timed out. Try again.';
		case 'not-supported':
			return 'Geolocation is not available in this browser.';
		default: {
			const exhaustive: never = error;
			return exhaustive;
		}
	}
};

export const emptyAreaMessage = (kind: LayerKind): string => {
	switch (kind) {
		case 'water':
			return 'No water points found in this area. Try zooming out or panning to a different location.';
		case 'toilet':
			return 'No public toilets found in this area.';
		case 'viewpoint':
			return 'No viewpoints found in this area.';
		default: {
			const exhaustive: never = kind;
			return exhaustive;
		}
	}
};
