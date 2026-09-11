import { hasOptedOutOfTracking } from './do-not-track';
import type { UmamiEventData, UmamiTracker } from './umami';
import { isUmamiAvailable } from './umami';

const enabledTracker = (): UmamiTracker | null => {
	if (hasOptedOutOfTracking() || typeof window === 'undefined') {
		return null;
	}
	const { umami } = window;
	return isUmamiAvailable(umami) ? umami : null;
};

export const isAnalyticsEnabled = (): boolean => enabledTracker() !== null;

const ignoreTrackingFailure = (): void => undefined;

export const safeTrack = (eventName: string, data?: UmamiEventData): void => {
	try {
		const tracker = enabledTracker();
		if (tracker === null) {
			return;
		}
		if (data !== undefined) {
			tracker.track(eventName, data);
		} else {
			tracker.track(eventName);
		}
	} catch {
		ignoreTrackingFailure();
	}
};
