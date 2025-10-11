/**
 * Geolocation functionality
 */

import * as L from 'leaflet';
import { GEOLOCATION_OPTIONS, USER_LOCATION_STYLE } from '../../core/config';
import { showNotification } from '../../ui/notifications';
import { showLoading, hideLoading } from '../../ui/loading';
import type { Result } from '../../types/result';
import type { LocationError } from '../../types/errors';
import { Ok, Err } from '../../types/result';

/**
 * Check if geolocation is available and context is secure
 */
function checkGeolocationAvailability(): string | null {
	if (!('geolocation' in navigator)) {
		return 'Geolocation is not available in this browser.';
	}

	const isSecure =
		location.protocol === 'https:' ||
		location.hostname === 'localhost' ||
		location.hostname === '127.0.0.1';

	if (!isSecure) {
		return 'Geolocation requires a secure context (HTTPS) or localhost. Serve the page from http://localhost or via HTTPS to enable location.';
	}

	return null;
}

/**
 * Get user-friendly error message for geolocation error
 */
function getGeolocationErrorMessage(error: GeolocationPositionError): string {
	switch (error.code) {
		case error.PERMISSION_DENIED:
			return 'Permission to access location was denied. Check your browser site settings and allow location access.';
		case error.POSITION_UNAVAILABLE:
			return 'Location information is unavailable.';
		case error.TIMEOUT:
			return 'Location request timed out. Try again.';
		default:
			return `Unable to retrieve your location: ${error.message}`;
	}
}

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
 * Detect user's initial location on page load
 * @returns Result containing GeolocationPosition or LocationError
 */
export function detectInitialLocation(): Promise<Result<GeolocationPosition, LocationError>> {
	// Check if geolocation is supported
	if (!('geolocation' in navigator)) {
		return Promise.resolve(
			Err({
				type: 'not-supported',
				message: 'Geolocation is not supported in this browser',
			})
		);
	}

	// Check for secure context (HTTPS or localhost)
	const isSecure =
		location.protocol === 'https:' ||
		location.hostname === 'localhost' ||
		location.hostname === '127.0.0.1';

	if (!isSecure) {
		return Promise.resolve(
			Err({
				type: 'not-supported',
				message: 'Geolocation requires a secure context (HTTPS or localhost)',
			})
		);
	}

	// Request current position
	return new Promise((resolve) => {
		navigator.geolocation.getCurrentPosition(
			(position) => resolve(Ok(position)),
			(error) => resolve(Err(mapGeolocationError(error))),
			GEOLOCATION_OPTIONS
		);
	});
}

/**
 * Locate user on map and show their position
 * @param map - Leaflet map instance
 */
export function locateUser(map: L.Map): void {
	// Check availability
	const availabilityError = checkGeolocationAvailability();
	if (availabilityError) {
		showNotification(availabilityError, 'error', 5000);
		return;
	}

	// Show loading state
	showLoading(200);

	// Get current position
	navigator.geolocation.getCurrentPosition(
		(position) => {
			hideLoading();

			const lat = position.coords.latitude;
			const lon = position.coords.longitude;
			const accuracy = position.coords.accuracy;

			// Add accuracy circle
			L.circle([lat, lon], {
				radius: Math.max(USER_LOCATION_STYLE.minRadius, accuracy),
				color: USER_LOCATION_STYLE.color,
				fillColor: USER_LOCATION_STYLE.fillColor,
				fillOpacity: USER_LOCATION_STYLE.fillOpacity,
			}).addTo(map);

			// Add marker
			const userMarker = L.marker([lat, lon]).addTo(map);
			userMarker.bindPopup('You are here (approx.)').openPopup();

			// Center map on user location
			map.setView([lat, lon], 13);

			// Success notification
			showNotification('Location found! Centered on your position.', 'success', 3000);
		},
		(error) => {
			hideLoading();
			const message = getGeolocationErrorMessage(error);
			showNotification(message, 'error', 5000);
		},
		GEOLOCATION_OPTIONS
	);
}
