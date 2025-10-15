/**
 * Unit tests for application configuration
 */

import { describe, expect, it } from 'vitest';
import {
	COLOUR_MAP,
	DEFAULT_ZOOM,
	MAX_ZOOM,
	OSM_ATTRIBUTION,
	OSM_TILE_URL,
	OVERPASS_API_URL,
	RIGA_CENTER,
} from '../../../src/core/config';

describe('Configuration', () => {
	describe('Map center coordinates', () => {
		it('should define RIGA_CENTER', () => {
			expect(RIGA_CENTER).toBeDefined();
			expect(Array.isArray(RIGA_CENTER)).toBe(true);
			expect(RIGA_CENTER).toHaveLength(2);
		});

		it('should have valid latitude', () => {
			const [lat] = RIGA_CENTER;
			expect(lat).toBeGreaterThanOrEqual(-90);
			expect(lat).toBeLessThanOrEqual(90);
		});

		it('should have valid longitude', () => {
			const [, lon] = RIGA_CENTER;
			expect(lon).toBeGreaterThanOrEqual(-180);
			expect(lon).toBeLessThanOrEqual(180);
		});
	});

	describe('Zoom levels', () => {
		it('should define DEFAULT_ZOOM', () => {
			expect(DEFAULT_ZOOM).toBeDefined();
			expect(typeof DEFAULT_ZOOM).toBe('number');
		});

		it('should define MAX_ZOOM', () => {
			expect(MAX_ZOOM).toBeDefined();
			expect(typeof MAX_ZOOM).toBe('number');
		});

		it('should have max zoom greater than default', () => {
			expect(MAX_ZOOM).toBeGreaterThanOrEqual(DEFAULT_ZOOM);
		});
	});

	describe('OSM configuration', () => {
		it('should define OSM_TILE_URL', () => {
			expect(OSM_TILE_URL).toBeDefined();
			expect(typeof OSM_TILE_URL).toBe('string');
			expect(OSM_TILE_URL).toContain('https://');
		});

		it('should define OSM_ATTRIBUTION', () => {
			expect(OSM_ATTRIBUTION).toBeDefined();
			expect(typeof OSM_ATTRIBUTION).toBe('string');
		});

		it('should define OVERPASS_API_URL', () => {
			expect(OVERPASS_API_URL).toBeDefined();
			expect(typeof OVERPASS_API_URL).toBe('string');
			expect(OVERPASS_API_URL).toMatch(/^https:\/\//);
		});
	});

	describe('Colour mapping', () => {
		it('should define COLOUR_MAP', () => {
			expect(COLOUR_MAP).toBeDefined();
			expect(typeof COLOUR_MAP).toBe('object');
		});

		it('should have valid hex color codes', () => {
			Object.values(COLOUR_MAP).forEach((color) => {
				expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
			});
		});
	});
});
