/**
 * Unit tests for notification system
 * Tests basic functionality and error handling
 */

import { describe, it, expect } from 'vitest';
import { showNotification, dismissNotification } from '../../../src/ui/notifications';

describe('Notifications', () => {
	describe('showNotification', () => {
		it('should return a valid notification ID', () => {
			const id = showNotification('Test message');
			expect(id).toBeDefined();
			expect(typeof id).toBe('string');
			expect(id).toContain('notification-');
			expect(id).toMatch(/^notification-\d+-[\d.]+$/);
		});

		it('should not throw when called with valid parameters', () => {
			expect(() => showNotification('Test')).not.toThrow();
		});

		it('should accept all notification types', () => {
			expect(() => showNotification('Info', 'info')).not.toThrow();
			expect(() => showNotification('Success', 'success')).not.toThrow();
			expect(() => showNotification('Error', 'error')).not.toThrow();
			expect(() => showNotification('Warning', 'warning')).not.toThrow();
		});

		it('should accept duration parameter', () => {
			expect(() => showNotification('Test', 'info', 3000)).not.toThrow();
			expect(() => showNotification('Test', 'info', 0)).not.toThrow();
			expect(() => showNotification('Test', 'info', 5000)).not.toThrow();
		});

		it('should return unique IDs for multiple notifications', () => {
			const id1 = showNotification('First');
			const id2 = showNotification('Second');
			expect(id1).not.toBe(id2);
		});

		it('should use default values when optional parameters are omitted', () => {
			expect(() => showNotification('Message')).not.toThrow();
		});
	});

	describe('dismissNotification', () => {
		it('should not throw with valid notification ID', () => {
			const id = showNotification('Test');
			expect(() => dismissNotification(id)).not.toThrow();
		});

		it('should handle invalid ID gracefully without throwing', () => {
			expect(() => dismissNotification('invalid-id')).not.toThrow();
			expect(() => dismissNotification('')).not.toThrow();
			expect(() => dismissNotification('notification-123-456')).not.toThrow();
		});

		it('should handle multiple dismissals of the same ID', () => {
			const id = showNotification('Test');
			expect(() => {
				dismissNotification(id);
				dismissNotification(id);
				dismissNotification(id);
			}).not.toThrow();
		});
	});
});
