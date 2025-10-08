/**
 * Unit tests for navigation functionality
 * Tests platform detection and URL generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openNavigation } from '../../../src/features/navigation/navigation';

// Mock the platform detection module
vi.mock('../../../src/types/platform', () => ({
  detectPlatform: vi.fn(),
}));

import { detectPlatform } from '../../../src/types/platform';

describe('Navigation', () => {
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;
  let windowLocationSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    windowLocationSpy = vi.spyOn(window.location, 'href', 'set').mockImplementation(() => {});
  });

  describe('Android platform', () => {
    beforeEach(() => {
      vi.mocked(detectPlatform).mockReturnValue({ type: 'android' });
    });

    it('should generate geo URI for Android', () => {
      openNavigation('56.9496', '24.1052', 'Water Fountain');

      expect(windowLocationSpy).toHaveBeenCalledWith(
        expect.stringContaining('geo:56.949600,24.105200')
      );
    });

    it('should include label in geo URI', () => {
      openNavigation('56.9496', '24.1052', 'Test Location');

      expect(windowLocationSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test%20Location')
      );
    });

    it('should use window.location.href for mobile', () => {
      openNavigation('56.9496', '24.1052', 'Test');

      expect(windowLocationSpy).toHaveBeenCalled();
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('should handle special characters in label', () => {
      openNavigation('56.9496', '24.1052', 'Test & Location');

      expect(windowLocationSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test%20%26%20Location')
      );
    });

    it('should format coordinates to 6 decimal places', () => {
      openNavigation('56.949612345', '24.105298765', 'Test');

      expect(windowLocationSpy).toHaveBeenCalledWith(
        expect.stringContaining('56.949612')
      );
      expect(windowLocationSpy).toHaveBeenCalledWith(
        expect.stringContaining('24.105299')
      );
    });
  });

  describe('iOS platform', () => {
    beforeEach(() => {
      vi.mocked(detectPlatform).mockReturnValue({ type: 'ios' });
    });

    it('should generate Apple Maps URI for iOS', () => {
      openNavigation('56.9496', '24.1052', 'Water Fountain');

      expect(windowLocationSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://maps.apple.com/')
      );
      expect(windowLocationSpy).toHaveBeenCalledWith(
        expect.stringContaining('daddr=56.949600,24.105200')
      );
    });

    it('should include query parameter with label', () => {
      openNavigation('56.9496', '24.1052', 'Test Location');

      expect(windowLocationSpy).toHaveBeenCalledWith(
        expect.stringContaining('q=Test%20Location')
      );
    });

    it('should use window.location.href for mobile', () => {
      openNavigation('56.9496', '24.1052', 'Test');

      expect(windowLocationSpy).toHaveBeenCalled();
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });
  });

  describe('Desktop platform', () => {
    beforeEach(() => {
      vi.mocked(detectPlatform).mockReturnValue({ type: 'desktop' });
    });

    it('should generate Google Maps URI for desktop', () => {
      openNavigation('56.9496', '24.1052', 'Water Fountain');

      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://www.google.com/maps/dir/'),
        '_blank',
        'noopener'
      );
    });

    it('should include destination parameter', () => {
      openNavigation('56.9496', '24.1052', 'Test Location');

      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.stringContaining('destination=56.949600,24.105200'),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should include walking travel mode', () => {
      openNavigation('56.9496', '24.1052', 'Test');

      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.stringContaining('travelmode=walking'),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should open in new tab with noopener', () => {
      openNavigation('56.9496', '24.1052', 'Test');

      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.any(String),
        '_blank',
        'noopener'
      );
    });

    it('should use window.open for desktop', () => {
      openNavigation('56.9496', '24.1052', 'Test');

      expect(windowOpenSpy).toHaveBeenCalled();
      expect(windowLocationSpy).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty label', () => {
      vi.mocked(detectPlatform).mockReturnValue({ type: 'android' });
      openNavigation('56.9496', '24.1052', '');

      expect(windowLocationSpy).toHaveBeenCalledWith(
        expect.stringContaining('Destination')
      );
    });

    it('should handle negative coordinates', () => {
      vi.mocked(detectPlatform).mockReturnValue({ type: 'desktop' });
      openNavigation('-33.8688', '-74.0060', 'Test');

      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.stringContaining('destination=-33.868800,-74.006000'),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should handle coordinates with many decimals', () => {
      vi.mocked(detectPlatform).mockReturnValue({ type: 'android' });
      openNavigation('56.949612345678', '24.105298765432', 'Test');

      // Should round to 6 decimals
      expect(windowLocationSpy).toHaveBeenCalledWith(
        expect.stringContaining('56.949612')
      );
    });

    it('should encode special characters in label', () => {
      vi.mocked(detectPlatform).mockReturnValue({ type: 'ios' });
      openNavigation('56.9496', '24.1052', 'Test <script>alert(1)</script>');

      expect(windowLocationSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('<script>')
      );
      expect(windowLocationSpy).toHaveBeenCalledWith(
        expect.stringContaining('%3C')
      );
    });
  });
});

