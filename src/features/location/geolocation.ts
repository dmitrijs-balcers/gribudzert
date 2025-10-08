/**
 * Geolocation functionality
 */

import * as L from "leaflet";
import { GEOLOCATION_OPTIONS, USER_LOCATION_STYLE } from "../../core/config";

/**
 * Check if geolocation is available and context is secure
 */
function checkGeolocationAvailability(): string | null {
  if (!("geolocation" in navigator)) {
    return "Geolocation is not available in this browser.";
  }

  const isSecure =
    location.protocol === "https:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  if (!isSecure) {
    return "Geolocation requires a secure context (HTTPS) or localhost. Serve the page from http://localhost or via HTTPS to enable location.";
  }

  return null;
}

/**
 * Get user-friendly error message for geolocation error
 */
function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Permission to access location was denied. Check your browser site settings and allow location access.";
    case error.POSITION_UNAVAILABLE:
      return "Location information is unavailable.";
    case error.TIMEOUT:
      return "Location request timed out. Try again.";
    default:
      return `Unable to retrieve your location: ${error.message}`;
  }
}

/**
 * Locate user on map and show their position
 * @param map - Leaflet map instance
 */
export function locateUser(map: L.Map): void {
  // Check availability
  const availabilityError = checkGeolocationAvailability();
  if (availabilityError) {
    alert(availabilityError);
    return;
  }

  // Get current position
  navigator.geolocation.getCurrentPosition(
    (position) => {
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
      userMarker.bindPopup("You are here (approx.)").openPopup();

      // Center map on user location
      map.setView([lat, lon], 13);
    },
    (error) => {
      const message = getGeolocationErrorMessage(error);
      alert(message);
    },
    GEOLOCATION_OPTIONS,
  );
}
