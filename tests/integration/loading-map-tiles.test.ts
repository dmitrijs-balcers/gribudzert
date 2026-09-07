import { describe, expect, it } from 'vitest';
import { renderApp } from '../harness';

describe('Loading map tiles', () => {
	it('requests every tile image anonymously so the offline worker can cache it', async () => {
		const app = await renderApp();

		const tileImages = Array.from(app.container.querySelectorAll('img.leaflet-tile'));

		expect(tileImages.length).toBeGreaterThan(0);
		for (const image of tileImages) {
			const crossOrigin =
				image instanceof HTMLImageElement ? image.crossOrigin : image.getAttribute('crossorigin');
			expect(crossOrigin).toBe('anonymous');
		}
	});
});
