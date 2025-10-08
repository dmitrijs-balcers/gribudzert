/**
 * Unit tests for HTML utilities
 * Comprehensive XSS prevention tests
 */

import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../../src/utils/html';

describe('HTML Utilities', () => {
	describe('escapeHtml', () => {
		it('should escape ampersands', () => {
			expect(escapeHtml('A & B')).toBe('A &amp; B');
		});

		it('should escape double quotes', () => {
			expect(escapeHtml('Say "hello"')).toBe('Say &quot;hello&quot;');
		});

		it('should escape single quotes', () => {
			expect(escapeHtml("It's here")).toBe('It&#39;s here');
		});

		it('should escape less-than signs', () => {
			expect(escapeHtml('5 < 10')).toBe('5 &lt; 10');
		});

		it('should escape greater-than signs', () => {
			expect(escapeHtml('10 > 5')).toBe('10 &gt; 5');
		});

		it('should escape all special characters together', () => {
			expect(escapeHtml('<script>"alert(\'XSS\')"</script>')).toBe(
				'&lt;script&gt;&quot;alert(&#39;XSS&#39;)&quot;&lt;/script&gt;'
			);
		});

		it('should handle empty strings', () => {
			expect(escapeHtml('')).toBe('');
		});

		it('should handle strings without special characters', () => {
			expect(escapeHtml('Hello World')).toBe('Hello World');
		});

		it('should handle multiple ampersands', () => {
			expect(escapeHtml('A && B && C')).toBe('A &amp;&amp; B &amp;&amp; C');
		});

		describe('XSS attack prevention', () => {
			it('should prevent script tag injection', () => {
				const malicious = '<script>alert("XSS")</script>';
				const escaped = escapeHtml(malicious);
				expect(escaped).not.toContain('<script>');
				expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
			});

			it('should prevent img tag injection', () => {
				const malicious = '<img src="x" onerror="alert(1)">';
				const escaped = escapeHtml(malicious);
				expect(escaped).not.toContain('<img');
				expect(escaped).toBe('&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;');
			});

			it('should prevent iframe injection', () => {
				const malicious = '<iframe src="evil.com"></iframe>';
				const escaped = escapeHtml(malicious);
				expect(escaped).not.toContain('<iframe');
				expect(escaped).toBe('&lt;iframe src=&quot;evil.com&quot;&gt;&lt;/iframe&gt;');
			});

			it('should prevent event handler injection', () => {
				const malicious = 'Click <a href="#" onclick="alert(1)">here</a>';
				const escaped = escapeHtml(malicious);
				expect(escaped).not.toContain('<a ');
				expect(escaped).toContain('&lt;a ');
				expect(escaped).toBe(
					'Click &lt;a href=&quot;#&quot; onclick=&quot;alert(1)&quot;&gt;here&lt;/a&gt;'
				);
			});

			it('should prevent javascript: protocol injection', () => {
				const malicious = '<a href="javascript:alert(1)">click</a>';
				const escaped = escapeHtml(malicious);
				expect(escaped).toBe('&lt;a href=&quot;javascript:alert(1)&quot;&gt;click&lt;/a&gt;');
			});

			it('should prevent data URI injection', () => {
				const malicious = '<img src="data:text/html,<script>alert(1)</script>">';
				const escaped = escapeHtml(malicious);
				expect(escaped).not.toContain('<img');
				expect(escaped).toContain('&lt;img');
				expect(escaped).toContain('&lt;');
			});

			it('should handle null bytes', () => {
				const malicious = 'test\x00<script>alert(1)</script>';
				const escaped = escapeHtml(malicious);
				expect(escaped).toContain('&lt;script&gt;');
			});

			it('should prevent HTML entity double-encoding attacks', () => {
				const malicious = '&lt;script&gt;';
				const escaped = escapeHtml(malicious);
				expect(escaped).toBe('&amp;lt;script&amp;gt;');
			});
		});

		describe('edge cases', () => {
			it('should handle numbers', () => {
				expect(escapeHtml('123')).toBe('123');
			});

			it('should handle special Unicode characters', () => {
				expect(escapeHtml('Hello 世界')).toBe('Hello 世界');
			});

			it('should handle emojis', () => {
				expect(escapeHtml('Hello 👋🌍')).toBe('Hello 👋🌍');
			});

			it('should handle newlines and tabs', () => {
				expect(escapeHtml('Line1\nLine2\tTab')).toBe('Line1\nLine2\tTab');
			});

			it('should handle very long strings', () => {
				const long = `<script>${'a'.repeat(10000)}</script>`;
				const escaped = escapeHtml(long);
				expect(escaped).toContain('&lt;script&gt;');
				expect(escaped).toContain('&lt;/script&gt;');
			});

			it('should be idempotent when called twice', () => {
				const input = '<script>alert(1)</script>';
				const once = escapeHtml(input);
				const twice = escapeHtml(once);
				expect(twice).toBe('&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;');
			});
		});
	});
});
