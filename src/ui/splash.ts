/**
 * The inline splash screen from index.html. It paints before any JavaScript runs so a
 * slow network never leaves the user on a blank page; this module only takes it down
 * once the map is on screen (or initialization has failed and the error toast is up).
 */

export const SPLASH_ID = 'splash';

export const SPLASH_HIDDEN_CLASS = 'splash-hidden';

/**
 * Upper bound on the fade-out, so the element is removed even if `transitionend`
 * never fires (reduced motion, background tab, no transition support).
 */
export const SPLASH_REMOVE_FALLBACK_MS = 600;

/**
 * Fade the splash out and remove it from the DOM. Safe to call more than once and
 * when no splash is present (tests, dev builds that stripped it).
 */
export const dismissSplash = (doc: Document = document): void => {
	const splash = doc.getElementById(SPLASH_ID);
	if (splash === null || splash.classList.contains(SPLASH_HIDDEN_CLASS)) {
		return;
	}
	let removed = false;
	const remove = (): void => {
		if (removed) {
			return;
		}
		removed = true;
		splash.remove();
	};
	splash.addEventListener('transitionend', remove, { once: true });
	setTimeout(remove, SPLASH_REMOVE_FALLBACK_MS);
	splash.classList.add(SPLASH_HIDDEN_CLASS);
};
