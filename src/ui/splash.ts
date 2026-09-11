export const SPLASH_ID = 'splash';

export const SPLASH_HIDDEN_CLASS = 'splash-hidden';

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
