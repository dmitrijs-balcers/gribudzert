/**
 * Platform-aware navigation functionality
 */

import { detectPlatform } from '../../types/platform';

/**
 * Generate navigation URI for the given platform
 */
function generateNavigationUri(
	lat: string,
	lon: string,
	label: string,
	platformType: 'android' | 'ios' | 'desktop'
): string {
	const latStr = Number(lat).toFixed(6);
	const lonStr = Number(lon).toFixed(6);
	const labelEnc = encodeURIComponent(label || 'Destination');

	switch (platformType) {
		case 'android':
			return `geo:${latStr},${lonStr}?q=${latStr},${lonStr}(${labelEnc})`;
		case 'ios':
			return `https://maps.apple.com/?daddr=${latStr},${lonStr}&q=${labelEnc}`;
		case 'desktop':
			return `https://www.google.com/maps/dir/?api=1&destination=${latStr},${lonStr}&travelmode=walking`;
	}
}

/**
 * Open navigation to the given coordinates using platform-appropriate app
 * @param lat - Latitude as string
 * @param lon - Longitude as string
 * @param label - Label for the destination
 */
export function openNavigation(lat: string, lon: string, label: string): void {
	const platform = detectPlatform();
	const uri = generateNavigationUri(lat, lon, label, platform.type);

	if (platform.type === 'desktop') {
		// Desktop: open in new tab
		window.open(uri, '_blank', 'noopener');
	} else {
		// Mobile: navigate directly
		window.location.href = uri;
	}
}
