/**
 * Unit tests for branded domain types
 */

import { describe, it, expect } from 'vitest';
import { nodeId, latitude, longitude, colorCode, coordinates } from '../../../src/types/domain';

describe('Domain Types', () => {
	describe('NodeId', () => {
		it('should create NodeId from number', () => {
			const id = nodeId(123456789);
			expect(id).toBe('123456789');
		});

		it('should handle large numbers', () => {
			const id = nodeId(9876543210);
			expect(id).toBe('9876543210');
		});
	});

	describe('Latitude', () => {
		it('should create valid latitude', () => {
			const lat = latitude(56.9496);
			expect(lat).toBe(56.9496);
		});

		it('should accept latitude at boundaries', () => {
			expect(latitude(90)).toBe(90);
			expect(latitude(-90)).toBe(-90);
			expect(latitude(0)).toBe(0);
		});

		it('should reject latitude above 90', () => {
			expect(latitude(90.1)).toBe(null);
			expect(latitude(100)).toBe(null);
		});

		it('should reject latitude below -90', () => {
			expect(latitude(-90.1)).toBe(null);
			expect(latitude(-100)).toBe(null);
		});

		it('should reject NaN', () => {
			expect(latitude(NaN)).toBe(null);
		});

		it('should reject Infinity', () => {
			expect(latitude(Infinity)).toBe(null);
			expect(latitude(-Infinity)).toBe(null);
		});
	});

	describe('Longitude', () => {
		it('should create valid longitude', () => {
			const lon = longitude(24.1052);
			expect(lon).toBe(24.1052);
		});

		it('should accept longitude at boundaries', () => {
			expect(longitude(180)).toBe(180);
			expect(longitude(-180)).toBe(-180);
			expect(longitude(0)).toBe(0);
		});

		it('should reject longitude above 180', () => {
			expect(longitude(180.1)).toBe(null);
			expect(longitude(200)).toBe(null);
		});

		it('should reject longitude below -180', () => {
			expect(longitude(-180.1)).toBe(null);
			expect(longitude(-200)).toBe(null);
		});

		it('should reject NaN', () => {
			expect(longitude(NaN)).toBe(null);
		});
	});

	describe('ColorCode', () => {
		it('should create valid color code', () => {
			const color = colorCode('#FF0000');
			expect(color).toBe('#FF0000');
		});

		it('should accept lowercase hex', () => {
			expect(colorCode('#ff0000')).toBe('#ff0000');
		});

		it('should reject color without hash', () => {
			expect(colorCode('FF0000')).toBe(null);
		});

		it('should reject short hex codes', () => {
			expect(colorCode('#FFF')).toBe(null);
		});

		it('should reject invalid characters', () => {
			expect(colorCode('#GG0000')).toBe(null);
		});
	});

	describe('Coordinates', () => {
		it('should create valid coordinates', () => {
			const coords = coordinates(56.9496, 24.1052);
			expect(coords).not.toBe(null);
			expect(coords?.lat).toBe(56.9496);
			expect(coords?.lon).toBe(24.1052);
		});

		it('should reject invalid latitude', () => {
			expect(coordinates(91, 24.1052)).toBe(null);
			expect(coordinates(-91, 24.1052)).toBe(null);
		});

		it('should reject invalid longitude', () => {
			expect(coordinates(56.9496, 181)).toBe(null);
			expect(coordinates(56.9496, -181)).toBe(null);
		});

		it('should reject both invalid', () => {
			expect(coordinates(91, 181)).toBe(null);
		});
	});
});
