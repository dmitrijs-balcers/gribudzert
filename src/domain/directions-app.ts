export type DirectionsPlatform = 'apple' | 'android' | 'web';

export type DirectionsApp = 'apple-maps' | 'osmand' | 'google-maps' | 'device-chooser';

export type DirectionsChoice = {
	readonly chosen: DirectionsApp;
	readonly alternative: DirectionsApp | null;
};

const DIRECTIONS_APPS: readonly DirectionsApp[] = [
	'apple-maps',
	'osmand',
	'google-maps',
	'device-chooser',
];

/**
 * Apps offered per platform, the platform default first. Android hands the
 * choice to the system chooser, so it needs no in-app alternative; the web
 * cannot open native apps at all.
 */
const OFFERED: Readonly<Record<DirectionsPlatform, readonly [DirectionsApp, ...DirectionsApp[]]>> =
	{
		apple: ['apple-maps', 'osmand'],
		android: ['device-chooser'],
		web: ['google-maps'],
	};

export const isDirectionsApp = (value: unknown): value is DirectionsApp =>
	typeof value === 'string' && DIRECTIONS_APPS.some((app) => app === value);

export const directionsAppsOffered = (platform: DirectionsPlatform): readonly DirectionsApp[] =>
	OFFERED[platform];

export const chooseDirectionsApp = (
	platform: DirectionsPlatform,
	preferred: DirectionsApp | null
): DirectionsChoice => {
	const offered = OFFERED[platform];
	const chosen = preferred !== null && offered.includes(preferred) ? preferred : offered[0];
	const alternative = offered.find((app) => app !== chosen) ?? null;
	return { chosen, alternative };
};
