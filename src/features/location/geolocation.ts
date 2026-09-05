/**
 * Geolocation functionality
 * Detecting the viewer's position and rendering it on the map.
 */

import * as L from 'leaflet';
import { trackLocateFailed, trackLocateRequested, trackLocateSuccess } from '../../analytics';
import { GEOLOCATION_OPTIONS, USER_LOCATION_STYLE } from '../../core/config';
import type { LatLon } from '../../domain';
import type { LocationError, LocationFailureCategory } from '../../types/errors';
import { toLocationFailureCategory } from '../../types/errors';
import type { Result } from '../../types/result';
import { Err, isErr, Ok } from '../../types/result';
import { withLoading } from '../../ui/loading';
import { showNotification } from '../../ui/notifications';

/**
 * Zoom level used when centring the map on the viewer
 */
export const LOCATE_ZOOM = 13;

/**
 * Popup text shown on the viewer's marker
 */
export const USER_LOCATION_POPUP = 'You are here (approx.)';

/**
 * A detected position with its accuracy radius in meters
 */
export type UserPosition = LatLon & {
	readonly accuracy: number;
};

/**
 * Whether the page runs in a context where the Geolocation API is allowed to work
 */
const isSecureContext = (): boolean =>
	location.protocol === 'https:' ||
	location.hostname === 'localhost' ||
	location.hostname === '127.0.0.1';

/**
 * Whether the browser exposes a usable Geolocation API (some privacy modes null it out)
 */
const hasGeolocation = (): boolean => {
	const geolocation: Geolocation | null | undefined = navigator.geolocation;
	return (
		geolocation !== null &&
		geolocation !== undefined &&
		typeof geolocation.getCurrentPosition === 'function'
	);
};

/**
 * Why geolocation cannot be attempted at all, before any permission prompt
 */
type Unavailability = {
	readonly error: LocationError;
	readonly reason: LocationFailureCategory;
	readonly userMessage: string;
};

/**
 * Check whether geolocation can be attempted; null when it can
 */
const checkAvailability = (): Unavailability | null => {
	if (!hasGeolocation()) {
		return {
			error: { type: 'not-supported', message: 'Geolocation is not supported in this browser' },
			reason: 'not_supported',
			userMessage: 'Geolocation is not available in this browser.',
		};
	}
	if (!isSecureContext()) {
		return {
			error: {
				type: 'not-supported',
				message: 'Geolocation requires a secure context (HTTPS or localhost)',
			},
			reason: 'insecure_context',
			userMessage:
				'Geolocation requires a secure context (HTTPS) or localhost. Serve the page from http://localhost or via HTTPS to enable location.',
		};
	}
	return null;
};

/**
 * Map GeolocationPositionError to LocationError discriminated union
 * @param error - Browser geolocation error
 * @returns LocationError with appropriate type
 */
export function mapGeolocationError(error: GeolocationPositionError): LocationError {
	switch (error.code) {
		case error.PERMISSION_DENIED:
			return {
				type: 'permission-denied',
				message: 'User denied location permission',
			};
		case error.POSITION_UNAVAILABLE:
			return {
				type: 'position-unavailable',
				message: 'Location information is unavailable',
			};
		case error.TIMEOUT:
			return {
				type: 'timeout',
				message: 'Location request timed out',
			};
		default:
			return {
				type: 'position-unavailable',
				message: `Unknown geolocation error: ${error.message}`,
			};
	}
}

/**
 * User-facing message for a location error
 */
export function locationErrorMessage(error: LocationError): string {
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
}

/**
 * Extract the fields the app needs from a browser position
 */
export const toUserPosition = (position: GeolocationPosition): UserPosition => ({
	lat: position.coords.latitude,
	lon: position.coords.longitude,
	accuracy: position.coords.accuracy,
});

/**
 * Ask the browser for the current position once
 */
const requestPosition = (): Promise<Result<GeolocationPosition, LocationError>> =>
	new Promise((resolve) => {
		navigator.geolocation.getCurrentPosition(
			(position) => resolve(Ok(position)),
			(error) => resolve(Err(mapGeolocationError(error))),
			GEOLOCATION_OPTIONS
		);
	});

/**
 * Detect user's initial location on page load
 * @returns Result containing GeolocationPosition or LocationError
 */
export function detectInitialLocation(): Promise<Result<GeolocationPosition, LocationError>> {
	const unavailable = checkAvailability();
	if (unavailable !== null) {
		return Promise.resolve(Err(unavailable.error));
	}
	return requestPosition();
}

/**
 * Map layer that renders the viewer's position (accuracy circle + marker).
 * Showing a new position replaces the previous one instead of stacking markers.
 */
export type UserLocationLayer = {
	readonly group: L.LayerGroup;
};

/**
 * Create the user-location layer and attach it to the map
 */
export function createUserLocationLayer(map: L.Map): UserLocationLayer {
	const group = L.layerGroup();
	group.addTo(map);
	return { group };
}

/**
 * Options for rendering the viewer's position
 */
export type ShowUserLocationOptions = {
	/** Open the "You are here" popup right away (default: false) */
	readonly openPopup?: boolean;
};

/**
 * Render a position on the user-location layer, replacing whatever it showed before
 * @returns The marker placed at the position
 */
export function showUserLocation(
	layer: UserLocationLayer,
	position: UserPosition,
	options: ShowUserLocationOptions = {}
): L.Marker {
	layer.group.clearLayers();

	const latLng: L.LatLngTuple = [position.lat, position.lon];
	const circle = L.circle(latLng, {
		radius: Math.max(USER_LOCATION_STYLE.minRadius, position.accuracy),
		color: USER_LOCATION_STYLE.color,
		fillColor: USER_LOCATION_STYLE.fillColor,
		fillOpacity: USER_LOCATION_STYLE.fillOpacity,
	});
	layer.group.addLayer(circle);

	const marker = L.marker(latLng);
	marker.bindPopup(USER_LOCATION_POPUP);
	layer.group.addLayer(marker);
	if (options.openPopup === true) {
		marker.openPopup();
	}
	return marker;
}

/**
 * Locate the viewer, render the position on the layer and centre the map on it.
 * Analytics events are tracked and the outcome is reported through notifications.
 * @param map - Leaflet map instance
 * @param layer - Layer that displays the viewer's position
 * @returns The detected position, or the LocationError that prevented it
 */
export async function locateUser(
	map: L.Map,
	layer: UserLocationLayer
): Promise<Result<LatLon, LocationError>> {
	trackLocateRequested();

	const unavailable = checkAvailability();
	if (unavailable !== null) {
		trackLocateFailed(unavailable.reason);
		showNotification(unavailable.userMessage, 'error', 5000);
		return Err(unavailable.error);
	}

	const result = await withLoading(requestPosition);
	if (isErr(result)) {
		trackLocateFailed(toLocationFailureCategory(result.error));
		showNotification(locationErrorMessage(result.error), 'error', 5000);
		return result;
	}

	trackLocateSuccess();
	const position = toUserPosition(result.value);
	showUserLocation(layer, position, { openPopup: true });
	map.setView([position.lat, position.lon], LOCATE_ZOOM);
	showNotification('Location found! Centered on your position.', 'success', 3000);

	return Ok({ lat: position.lat, lon: position.lon });
}
