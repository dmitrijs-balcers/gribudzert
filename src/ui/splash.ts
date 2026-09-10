/**
 * Takes down the inline splash from index.html once the app is on screen.
 * The splash itself is JS-free so it paints before any script arrives.
 */

export const SPLASH_ID = 'splash';

export const SPLASH_HIDDEN_CLASS = 'splash-hidden';

/** Removal deadline in case `transitionend` never fires (reduced motion, background tab) */
export const SPLASH_REMOVE_FALLBACK_MS = 600;

export const dismissSplash = (doc: Document = document): void => {
	const splash = doc.getElementById(SPLASH_ID);
	if (splash === null) {
		return;
	}
	const remove = (): void => splash.remove();
	splash.addEventListener('transitionend', remove, { once: true });
	setTimeout(remove, SPLASH_REMOVE_FALLBACK_MS);
	splash.classList.add(SPLASH_HIDDEN_CLASS);
};
