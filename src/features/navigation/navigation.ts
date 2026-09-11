export type Platform = 'ios' | 'android' | 'web';

export type NavigationDestination = {
	readonly lat: number;
	readonly lon: number;
};

const navigationUrlBuilders: Readonly<
	Record<Platform, (destination: NavigationDestination, label: string) => string>
> = {
	ios: ({ lat, lon }, label) =>
		`maps://maps.apple.com/?daddr=${lat},${lon}&q=${encodeURIComponent(label)}`,
	android: ({ lat, lon }) => `google.navigation:q=${lat},${lon}`,
	web: ({ lat, lon }, label) =>
		`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_place_id=${encodeURIComponent(label)}`,
};

export const navigationUrlFor = (
	platform: Platform,
	destination: NavigationDestination,
	label: string
): string => navigationUrlBuilders[platform](destination, label);

export const platformOf = (userAgent: string): Platform => {
	const lowered = userAgent.toLowerCase();
	if (/iphone|ipad|ipod/.test(lowered)) {
		return 'ios';
	}
	if (/android/.test(lowered)) {
		return 'android';
	}
	return 'web';
};

export function openNavigation(lat: string, lon: string, label: string): void {
	const latitude = Number.parseFloat(lat);
	const longitude = Number.parseFloat(lon);

	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		console.error('Invalid coordinates for navigation:', lat, lon);
		return;
	}

	const navigationUrl = navigationUrlFor(
		platformOf(navigator.userAgent),
		{ lat: latitude, lon: longitude },
		label
	);

	window.open(navigationUrl, '_blank', 'noopener,noreferrer');
}
