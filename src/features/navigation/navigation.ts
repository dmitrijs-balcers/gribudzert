/**
 * Open external navigation app to navigate to coordinates
 * @param lat - Latitude as string
 * @param lon - Longitude as string
 * @param label - Label for the destination
 */
export function openNavigation(lat: string, lon: string, label: string): void {
	const latitude = Number.parseFloat(lat);
	const longitude = Number.parseFloat(lon);

	// Validate coordinates
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		console.error('Invalid coordinates for navigation:', lat, lon);
		return;
	}

	// Detect platform and open appropriate navigation URL
	const userAgent = navigator.userAgent.toLowerCase();
	const isIOS = /iphone|ipad|ipod/.test(userAgent);
	const isAndroid = /android/.test(userAgent);

	let navigationUrl: string;

	if (isIOS) {
		// Use Apple Maps on iOS
		navigationUrl = `maps://maps.apple.com/?daddr=${latitude},${longitude}&q=${encodeURIComponent(label)}`;
	} else if (isAndroid) {
		// Use Google Maps on Android
		navigationUrl = `google.navigation:q=${latitude},${longitude}`;
	} else {
		// Default to Google Maps web for desktop
		navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodeURIComponent(label)}`;
	}

	// Open navigation URL
	window.open(navigationUrl, '_blank', 'noopener,noreferrer');
}
