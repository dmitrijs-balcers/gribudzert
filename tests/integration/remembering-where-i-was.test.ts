/**
 * The map remembers where the runner last stood, so the next visit is useful before any
 * fix arrives — as long as that memory isn't too old.
 */

import { waitFor } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { CACHE_TILE_ZOOM } from '../../src/core/config';
import { tileBounds, tileOf } from '../../src/domain';
import { RIGA, USER, WATER_MARKER_COUNT } from '../fixtures';
import { bboxCenter, GEO_POSITION_UNAVAILABLE, renderApp } from '../harness';

const maxCenterDriftFromTileRounding = (point: {
	readonly lat: number;
	readonly lon: number;
}): { lat: number; lon: number } => {
	const bounds = tileBounds(tileOf(point, CACHE_TILE_ZOOM));
	return { lat: bounds.north - bounds.south, lon: bounds.east - bounds.west };
};

describe('Remembering where I was', () => {
	it('centres on a remembered position immediately, with no fallback toast even when the live fix then fails', async () => {
		const app = await renderApp({
			rememberedPosition: { lat: USER.lat, lon: USER.lon, accuracy: 20 },
			geolocation: { error: GEO_POSITION_UNAVAILABLE },
		});

		const center = bboxCenter(app.overpass.lastRequest().bbox);
		const tolerance = maxCenterDriftFromTileRounding(USER);
		expect(Math.abs(center.lat - USER.lat)).toBeLessThan(tolerance.lat);
		expect(Math.abs(center.lon - USER.lon)).toBeLessThan(tolerance.lon);
		expect(app.userLocation()).toEqual({ markers: 1, circles: 1 });

		await waitFor(() => expect(app.locateButton().getAttribute('data-state')).toBe('failed'));
		expect(app.toasts()).not.toContain('Could not detect your location. Showing Riga area.');
	});

	it('ignores a memory older than 7 days and falls back to Riga instead', async () => {
		const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
		const app = await renderApp({
			rememberedPosition: { lat: USER.lat, lon: USER.lon, ageMs: eightDaysMs },
			geolocation: { pending: true },
		});

		const center = bboxCenter(app.overpass.lastRequest().bbox);
		const tolerance = maxCenterDriftFromTileRounding(RIGA);
		expect(Math.abs(center.lat - RIGA.lat)).toBeLessThan(tolerance.lat);
		expect(Math.abs(center.lon - RIGA.lon)).toBeLessThan(tolerance.lon);
		expect(app.userLocation()).toEqual({ markers: 0, circles: 0 });

		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
	});
});
