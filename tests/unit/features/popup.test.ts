/**
 * Unit tests for popup content and handlers
 * Tests content generation, escaping, and accessibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPopupContent, attachPopupHandlers } from '../../../src/features/markers/popup';
import type { Element } from '../../../src/types/overpass';

// Mock dependencies
vi.mock('../../../src/features/navigation/navigation', () => ({
	openNavigation: vi.fn(),
}));

vi.mock('../../../src/utils/logger', () => ({
	info: vi.fn(),
}));

import { openNavigation } from '../../../src/features/navigation/navigation';

describe('Popup', () => {
	describe('createPopupContent', () => {
		let basicElement: Element;

		beforeEach(() => {
			basicElement = {
				type: 'node',
				id: 123456789,
				lat: 56.9496,
				lon: 24.1052,
				tags: {
					amenity: 'drinking_water',
				},
			};
		});

		it('should create basic popup content', () => {
			const content = createPopupContent(basicElement);

			expect(content).toContain('Drinking Water');
			expect(content).toContain('123456789');
		});

		it('should include navigate button', () => {
			const content = createPopupContent(basicElement);

			expect(content).toContain('navigate-btn');
			expect(content).toContain('data-lat="56.9496"');
			expect(content).toContain('data-lon="24.1052"');
		});

		it('should include OSM link', () => {
			const content = createPopupContent(basicElement);

			expect(content).toContain('https://www.openstreetmap.org/node/123456789');
			expect(content).toContain('target="_blank"');
			expect(content).toContain('rel="noreferrer"');
		});

		it('should include operator if present', () => {
			basicElement.tags.operator = 'City Water Department';
			const content = createPopupContent(basicElement);

			expect(content).toContain('Operator:');
			expect(content).toContain('City Water Department');
		});

		it('should include note if present', () => {
			basicElement.tags.note = 'Behind the building';
			const content = createPopupContent(basicElement);

			expect(content).toContain('Note:');
			expect(content).toContain('Behind the building');
		});

		it('should include seasonal if present', () => {
			basicElement.tags.seasonal = 'yes';
			const content = createPopupContent(basicElement);

			expect(content).toContain('Seasonal:');
			expect(content).toContain('yes');
		});

		it('should include bottle if present', () => {
			basicElement.tags.bottle = 'yes';
			const content = createPopupContent(basicElement);

			expect(content).toContain('Bottle refill:');
			expect(content).toContain('yes');
		});

		it('should include wheelchair accessibility if present', () => {
			basicElement.tags.wheelchair = 'yes';
			const content = createPopupContent(basicElement);

			expect(content).toContain('Wheelchair:');
			expect(content).toContain('yes');
		});

		it('should include all tags when present', () => {
			basicElement.tags = {
				amenity: 'drinking_water',
				operator: 'City',
				note: 'Test note',
				seasonal: 'no',
				bottle: 'yes',
				wheelchair: 'yes',
			};

			const content = createPopupContent(basicElement);

			expect(content).toContain('Operator: City');
			expect(content).toContain('Note: Test note');
			expect(content).toContain('Seasonal: no');
			expect(content).toContain('Bottle refill: yes');
			expect(content).toContain('Wheelchair: yes');
		});

		describe('XSS prevention', () => {
			it('should escape HTML in operator', () => {
				basicElement.tags.operator = '<script>alert(1)</script>';
				const content = createPopupContent(basicElement);

				expect(content).not.toContain('<script>');
				expect(content).toContain('&lt;script&gt;');
			});

			it('should escape HTML in note', () => {
				basicElement.tags.note = '<img src=x onerror=alert(1)>';
				const content = createPopupContent(basicElement);

				expect(content).not.toContain('<img src=x');
				expect(content).toContain('&lt;img');
			});

			it('should escape quotes in tags', () => {
				basicElement.tags.note = 'Test "quoted" text';
				const content = createPopupContent(basicElement);

				expect(content).toContain('&quot;');
			});

			it('should handle malicious seasonal tag', () => {
				basicElement.tags.seasonal = '"><script>alert(1)</script>';
				const content = createPopupContent(basicElement);

				expect(content).not.toContain('"><script>');
				expect(content).toContain('&quot;&gt;&lt;script&gt;');
			});
		});

		describe('accessibility', () => {
			it('should include aria-label on navigate button', () => {
				const content = createPopupContent(basicElement);

				expect(content).toContain('aria-label="Navigate to drinking water 123456789"');
			});

			it('should include aria-hidden on icon', () => {
				const content = createPopupContent(basicElement);

				expect(content).toContain('aria-hidden="true"');
			});

			it('should use button type', () => {
				const content = createPopupContent(basicElement);

				expect(content).toContain('type="button"');
			});

			it('should have visible label text', () => {
				const content = createPopupContent(basicElement);

				expect(content).toContain('<span class="label">Navigate</span>');
			});
		});
	});

	describe('attachPopupHandlers', () => {
		interface MockMarker {
			on: ReturnType<typeof vi.fn>;
		}
		let mockMarker: MockMarker;
		let element: Element;
		let popupElement: HTMLElement;

		beforeEach(() => {
			vi.clearAllMocks();

			element = {
				type: 'node',
				id: 123456789,
				lat: 56.9496,
				lon: 24.1052,
				tags: { amenity: 'drinking_water' },
			};

			// Create actual DOM elements for testing
			popupElement = document.createElement('div');
			popupElement.innerHTML = createPopupContent(element);
			document.body.appendChild(popupElement);

			mockMarker = {
				on: vi.fn(),
			};
		});

		afterEach(() => {
			document.body.removeChild(popupElement);
		});

		it('should attach popupopen event handler', () => {
			attachPopupHandlers(mockMarker, element);

			expect(mockMarker.on).toHaveBeenCalledWith('popupopen', expect.any(Function));
		});

		it('should call openNavigation when navigate button is clicked', () => {
			attachPopupHandlers(mockMarker, element);

			// Get the popupopen handler
			const popupopenHandler = mockMarker.on.mock.calls[0][1];

			// Simulate popup open event
			const mockEvent = {
				popup: {
					getElement: () => popupElement,
				},
			};

			popupopenHandler(mockEvent);

			// Click the navigate button
			const navBtn = popupElement.querySelector('.navigate-btn') as HTMLButtonElement;
			expect(navBtn).not.toBe(null);

			navBtn?.click();

			expect(openNavigation).toHaveBeenCalledWith('56.9496', '24.1052', 'water_tap 123456789');
		});

		it('should not attach handler twice', () => {
			attachPopupHandlers(mockMarker, element);

			const popupopenHandler = mockMarker.on.mock.calls[0][1];
			const mockEvent = {
				popup: { getElement: () => popupElement },
			};

			// Call handler twice
			popupopenHandler(mockEvent);
			popupopenHandler(mockEvent);

			// Click button
			const navBtn = popupElement.querySelector('.navigate-btn') as HTMLButtonElement;
			navBtn?.click();

			// Should only be called once
			expect(openNavigation).toHaveBeenCalledTimes(1);
		});

		it('should set accessibility attributes on navigate button', () => {
			attachPopupHandlers(mockMarker, element);

			const popupopenHandler = mockMarker.on.mock.calls[0][1];
			const mockEvent = {
				popup: { getElement: () => popupElement },
			};

			popupopenHandler(mockEvent);

			const navBtn = popupElement.querySelector('.navigate-btn');
			expect(navBtn?.getAttribute('tabindex')).toBe('0');
			expect(navBtn?.getAttribute('role')).toBe('button');
		});

		it('should set accessibility attributes on OSM link', () => {
			attachPopupHandlers(mockMarker, element);

			const popupopenHandler = mockMarker.on.mock.calls[0][1];
			const mockEvent = {
				popup: { getElement: () => popupElement },
			};

			popupopenHandler(mockEvent);

			const osmLink = popupElement.querySelector('.popup-secondary');
			expect(osmLink?.getAttribute('role')).toBe('link');
			expect(osmLink?.getAttribute('tabindex')).toBe('0');
		});

		it('should handle missing popup element gracefully', () => {
			attachPopupHandlers(mockMarker, element);

			const popupopenHandler = mockMarker.on.mock.calls[0][1];
			const mockEvent = {
				popup: { getElement: () => null },
			};

			// Should not throw
			expect(() => popupopenHandler(mockEvent)).not.toThrow();
		});

		it('should handle missing navigate button gracefully', () => {
			popupElement.innerHTML = '<div>No button here</div>';

			attachPopupHandlers(mockMarker, element);

			const popupopenHandler = mockMarker.on.mock.calls[0][1];
			const mockEvent = {
				popup: { getElement: () => popupElement },
			};

			// Should not throw
			expect(() => popupopenHandler(mockEvent)).not.toThrow();
		});
	});
});

/**
 * Unit tests for branded domain types
 * Tests all type constructors and validators
 */

import {
	nodeId,
	latitude,
	longitude,
	colorCode,
	coordinates,
	type NodeId,
} from '../../../src/types/domain';

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

		it('should handle zero', () => {
			const id = nodeId(0);
			expect(id).toBe('0');
		});

		it('should preserve type brand (compile-time check)', () => {
			const id: NodeId = nodeId(123);
			// This ensures the brand is preserved
			expect(typeof id).toBe('string');
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

		it('should accept valid decimal values', () => {
			expect(latitude(45.123456)).toBe(45.123456);
			expect(latitude(-45.123456)).toBe(-45.123456);
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

		it('should reject Infinity', () => {
			expect(longitude(Infinity)).toBe(null);
			expect(longitude(-Infinity)).toBe(null);
		});

		it('should accept valid decimal values', () => {
			expect(longitude(120.987654)).toBe(120.987654);
			expect(longitude(-120.987654)).toBe(-120.987654);
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

		it('should accept mixed case', () => {
			expect(colorCode('#Ff00Aa')).toBe('#Ff00Aa');
		});

		it('should reject color without hash', () => {
			expect(colorCode('FF0000')).toBe(null);
		});

		it('should reject short hex codes', () => {
			expect(colorCode('#FFF')).toBe(null);
			expect(colorCode('#F0F')).toBe(null);
		});

		it('should reject long hex codes', () => {
			expect(colorCode('#FF00000')).toBe(null);
			expect(colorCode('#FF000000')).toBe(null);
		});

		it('should reject invalid characters', () => {
			expect(colorCode('#GG0000')).toBe(null);
			expect(colorCode('#FF00ZZ')).toBe(null);
		});

		it('should reject empty string', () => {
			expect(colorCode('')).toBe(null);
		});

		it('should accept all valid hex digits', () => {
			expect(colorCode('#0123456')).toBe(null); // 7 chars
			expect(colorCode('#ABCDEF')).toBe('#ABCDEF');
			expect(colorCode('#abcdef')).toBe('#abcdef');
		});
	});

	describe('Coordinates', () => {
		it('should create valid coordinates', () => {
			const coords = coordinates(56.9496, 24.1052);
			expect(coords).not.toBe(null);
			expect(coords?.lat).toBe(56.9496);
			expect(coords?.lon).toBe(24.1052);
		});

		it('should create coordinates at boundaries', () => {
			const coords1 = coordinates(90, 180);
			expect(coords1).not.toBe(null);
			expect(coords1?.lat).toBe(90);
			expect(coords1?.lon).toBe(180);

			const coords2 = coordinates(-90, -180);
			expect(coords2).not.toBe(null);
			expect(coords2?.lat).toBe(-90);
			expect(coords2?.lon).toBe(-180);
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

		it('should reject NaN values', () => {
			expect(coordinates(NaN, 24.1052)).toBe(null);
			expect(coordinates(56.9496, NaN)).toBe(null);
			expect(coordinates(NaN, NaN)).toBe(null);
		});

		it('should reject Infinity values', () => {
			expect(coordinates(Infinity, 24.1052)).toBe(null);
			expect(coordinates(56.9496, Infinity)).toBe(null);
		});

		it('should create coordinates at equator and prime meridian', () => {
			const coords = coordinates(0, 0);
			expect(coords).not.toBe(null);
			expect(coords?.lat).toBe(0);
			expect(coords?.lon).toBe(0);
		});
	});

	describe('real-world scenarios', () => {
		it('should validate Riga coordinates', () => {
			const rigaCoords = coordinates(56.9496, 24.1052);
			expect(rigaCoords).not.toBe(null);
		});

		it('should validate New York coordinates', () => {
			const nyCoords = coordinates(40.7128, -74.006);
			expect(nyCoords).not.toBe(null);
		});

		it('should validate Tokyo coordinates', () => {
			const tokyoCoords = coordinates(35.6762, 139.6503);
			expect(tokyoCoords).not.toBe(null);
		});

		it('should validate Sydney coordinates', () => {
			const sydneyCoords = coordinates(-33.8688, 151.2093);
			expect(sydneyCoords).not.toBe(null);
		});

		it('should reject coordinates from user input without validation', () => {
			// Simulating malicious or incorrect user input
			expect(coordinates(999, 999)).toBe(null);
			expect(coordinates(-999, -999)).toBe(null);
		});
	});
});
