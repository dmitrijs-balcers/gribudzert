const MOBILE_MAX_WIDTH_PX = 768;

const mediaMatches = (query: string): boolean => {
	try {
		return window.matchMedia(query).matches;
	} catch {
		return false;
	}
};

export const isRunningStandalone = (): boolean =>
	mediaMatches('(display-mode: standalone)') ||
	(navigator as Navigator & { readonly standalone?: boolean }).standalone === true;

export const isMobileViewport = (): boolean =>
	mediaMatches('(pointer: coarse)') || mediaMatches(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`);
