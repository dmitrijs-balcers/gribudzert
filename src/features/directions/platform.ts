export type DirectionsPlatform = 'apple' | 'android' | 'web';

const APPLE_DEVICE = /iphone|ipad|ipod/i;
const ANDROID_DEVICE = /android/i;

export const directionsPlatformOf = (userAgent: string): DirectionsPlatform => {
	if (APPLE_DEVICE.test(userAgent)) {
		return 'apple';
	}
	if (ANDROID_DEVICE.test(userAgent)) {
		return 'android';
	}
	return 'web';
};
