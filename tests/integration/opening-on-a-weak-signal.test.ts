/**
 * Opening the app on a trail with one bar of 3G: the inline splash from index.html paints
 * before any script runs, and the app takes it down only once the map is on screen.
 */

import { waitFor } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import {
	dismissSplash,
	SPLASH_HIDDEN_CLASS,
	SPLASH_ID,
	SPLASH_REMOVE_FALLBACK_MS,
} from '../../src/ui/splash';
import { renderApp } from '../harness';

const seedSplash = (): HTMLDivElement => {
	document.body.innerHTML = '';
	const splash = document.createElement('div');
	splash.id = SPLASH_ID;
	document.body.appendChild(splash);
	return splash;
};

describe('Opening on a weak signal', () => {
	it('takes the splash down once the map is on screen', async () => {
		const app = await renderApp({ splash: true, geolocation: { pending: true } });

		expect(app.container.classList.contains('leaflet-container')).toBe(true);
		await waitFor(() => expect(document.getElementById(SPLASH_ID)).toBeNull());
	});

	it('fades the splash out and removes it when the fade has ended', () => {
		const splash = seedSplash();

		dismissSplash();

		expect(splash.classList.contains(SPLASH_HIDDEN_CLASS)).toBe(true);
		expect(document.getElementById(SPLASH_ID)).not.toBeNull();
		splash.dispatchEvent(new Event('transitionend'));
		expect(document.getElementById(SPLASH_ID)).toBeNull();
	});

	it('still removes the splash when no fade transition ever ends', () => {
		vi.useFakeTimers();
		try {
			seedSplash();

			dismissSplash();
			vi.advanceTimersByTime(SPLASH_REMOVE_FALLBACK_MS);

			expect(document.getElementById(SPLASH_ID)).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('is harmless without a splash on the page', () => {
		document.body.innerHTML = '';

		expect(() => dismissSplash()).not.toThrow();
	});
});
