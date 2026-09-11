type WindowWithLegacyDoNotTrack = Window & { doNotTrack?: string };

export const hasOptedOutOfTracking = (): boolean => {
	if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') {
		return true;
	}
	return typeof window !== 'undefined' && (window as WindowWithLegacyDoNotTrack).doNotTrack === '1';
};
