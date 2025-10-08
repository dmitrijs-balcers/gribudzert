/**
 * Unit tests for DOM utilities
 * Tests edge cases and type guards
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	isHTMLElement,
	getAttribute,
	queryHTMLElement,
	isActivationKey,
} from '../../../src/utils/dom';

describe('DOM Utilities', () => {
	describe('isHTMLElement', () => {
		it('should return true for HTMLElement', () => {
			const el = document.createElement('div');
			expect(isHTMLElement(el)).toBe(true);
		});

		it('should return false for null', () => {
			expect(isHTMLElement(null)).toBe(false);
		});

		it('should return true for various HTML elements', () => {
			expect(isHTMLElement(document.createElement('div'))).toBe(true);
			expect(isHTMLElement(document.createElement('span'))).toBe(true);
			expect(isHTMLElement(document.createElement('button'))).toBe(true);
			expect(isHTMLElement(document.createElement('input'))).toBe(true);
		});

		it('should work with body element', () => {
			expect(isHTMLElement(document.body)).toBe(true);
		});
	});

	describe('getAttribute', () => {
		let element: HTMLElement;

		beforeEach(() => {
			element = document.createElement('div');
		});

		it('should return attribute value when it exists', () => {
			element.setAttribute('data-test', 'value');
			expect(getAttribute(element, 'data-test')).toBe('value');
		});

		it('should return null when attribute does not exist', () => {
			expect(getAttribute(element, 'nonexistent')).toBe(null);
		});

		it('should return empty string for empty attribute', () => {
			element.setAttribute('data-empty', '');
			expect(getAttribute(element, 'data-empty')).toBe('');
		});

		it('should work with standard HTML attributes', () => {
			element.setAttribute('id', 'test-id');
			element.setAttribute('class', 'test-class');
			expect(getAttribute(element, 'id')).toBe('test-id');
			expect(getAttribute(element, 'class')).toBe('test-class');
		});

		it('should work with ARIA attributes', () => {
			element.setAttribute('aria-label', 'Test Label');
			expect(getAttribute(element, 'aria-label')).toBe('Test Label');
		});

		it('should handle case-insensitive HTML attributes', () => {
			// HTML attributes are case-insensitive in the DOM
			element.setAttribute('data-Test', 'value');
			expect(getAttribute(element, 'data-test')).toBe('value');
			expect(getAttribute(element, 'data-Test')).toBe('value');
		});
	});

	describe('queryHTMLElement', () => {
		let container: HTMLElement;

		beforeEach(() => {
			container = document.createElement('div');
			container.innerHTML = `
        <div id="test-div">Test</div>
        <button class="test-button">Click</button>
        <span data-test="value">Span</span>
      `;
		});

		it('should find element by id', () => {
			const el = queryHTMLElement(container, '#test-div');
			expect(el).not.toBe(null);
			expect(el?.tagName).toBe('DIV');
		});

		it('should find element by class', () => {
			const el = queryHTMLElement(container, '.test-button');
			expect(el).not.toBe(null);
			expect(el?.tagName).toBe('BUTTON');
		});

		it('should find element by attribute', () => {
			const el = queryHTMLElement(container, '[data-test="value"]');
			expect(el).not.toBe(null);
			expect(el?.tagName).toBe('SPAN');
		});

		it('should return null when element not found', () => {
			const el = queryHTMLElement(container, '#nonexistent');
			expect(el).toBe(null);
		});

		it('should work with document as parent', () => {
			document.body.appendChild(container);
			const el = queryHTMLElement(document, '#test-div');
			expect(el).not.toBe(null);
			document.body.removeChild(container);
		});

		it('should return first matching element', () => {
			container.innerHTML = `
        <div class="item">First</div>
        <div class="item">Second</div>
      `;
			const el = queryHTMLElement(container, '.item');
			expect(el?.textContent).toBe('First');
		});

		it('should work with complex selectors', () => {
			const el = queryHTMLElement(container, 'div > button.test-button');
			expect(el).not.toBe(null);
		});
	});

	describe('isActivationKey', () => {
		it('should return true for Enter key', () => {
			const event = new KeyboardEvent('keydown', { key: 'Enter' });
			expect(isActivationKey(event)).toBe(true);
		});

		it('should return true for Space key', () => {
			const event = new KeyboardEvent('keydown', { key: ' ' });
			expect(isActivationKey(event)).toBe(true);
		});

		it('should return false for other keys', () => {
			expect(isActivationKey(new KeyboardEvent('keydown', { key: 'a' }))).toBe(false);
			expect(isActivationKey(new KeyboardEvent('keydown', { key: 'Escape' }))).toBe(false);
			expect(isActivationKey(new KeyboardEvent('keydown', { key: 'Tab' }))).toBe(false);
			expect(isActivationKey(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe(false);
		});

		it('should be case-sensitive for Enter', () => {
			const event = new KeyboardEvent('keydown', { key: 'enter' });
			expect(isActivationKey(event)).toBe(false);
		});

		it('should work with keyboard events from different sources', () => {
			const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter' });
			const keypressEvent = new KeyboardEvent('keypress', { key: 'Enter' });
			expect(isActivationKey(keydownEvent)).toBe(true);
			expect(isActivationKey(keypressEvent)).toBe(true);
		});
	});

	describe('integration scenarios', () => {
		it('should work together for safe element manipulation', () => {
			const container = document.createElement('div');
			container.innerHTML = '<button data-action="submit">Submit</button>';

			const button = queryHTMLElement(container, '[data-action="submit"]');
			expect(button).not.toBe(null);

			if (button && isHTMLElement(button)) {
				const action = getAttribute(button, 'data-action');
				expect(action).toBe('submit');
			}
		});

		it('should handle keyboard navigation safely', () => {
			const button = document.createElement('button');
			button.addEventListener('keydown', (e) => {
				if (isActivationKey(e as KeyboardEvent)) {
					button.click();
				}
			});

			const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
			expect(isActivationKey(enterEvent)).toBe(true);
		});
	});
});
/**
 * Unit tests for Result type
 * Tests all Result ADT functions: Ok, Err, map, flatMap, unwrap, etc.
 */

import {
	Ok,
	Err,
	isOk,
	isErr,
	mapResult,
	mapErr,
	flatMap,
	unwrap,
	unwrapOr,
	type Result,
} from '../../../src/types/result';

describe('Result Type', () => {
	describe('Ok constructor', () => {
		it('should create an Ok result', () => {
			const result = Ok(42);
			expect(result).toEqual({ kind: 'ok', value: 42 });
		});

		it('should work with string values', () => {
			const result = Ok('success');
			expect(result).toEqual({ kind: 'ok', value: 'success' });
		});

		it('should work with object values', () => {
			const result = Ok({ data: 'test' });
			expect(result).toEqual({ kind: 'ok', value: { data: 'test' } });
		});

		it('should work with null values', () => {
			const result = Ok(null);
			expect(result).toEqual({ kind: 'ok', value: null });
		});
	});

	describe('Err constructor', () => {
		it('should create an Err result', () => {
			const result = Err('error message');
			expect(result).toEqual({ kind: 'error', error: 'error message' });
		});

		it('should work with Error objects', () => {
			const error = new Error('test error');
			const result = Err(error);
			expect(result).toEqual({ kind: 'error', error });
		});

		it('should work with custom error types', () => {
			const result = Err({ code: 404, message: 'Not found' });
			expect(result).toEqual({ kind: 'error', error: { code: 404, message: 'Not found' } });
		});
	});

	describe('isOk type guard', () => {
		it('should return true for Ok results', () => {
			const result = Ok(42);
			expect(isOk(result)).toBe(true);
		});

		it('should return false for Err results', () => {
			const result = Err('error');
			expect(isOk(result)).toBe(false);
		});

		it('should narrow types correctly', () => {
			const result: Result<number, string> = Ok(42);
			if (isOk(result)) {
				// TypeScript should know result.value is a number
				const value: number = result.value;
				expect(value).toBe(42);
			}
		});
	});

	describe('isErr type guard', () => {
		it('should return true for Err results', () => {
			const result = Err('error');
			expect(isErr(result)).toBe(true);
		});

		it('should return false for Ok results', () => {
			const result = Ok(42);
			expect(isErr(result)).toBe(false);
		});

		it('should narrow types correctly', () => {
			const result: Result<number, string> = Err('failed');
			if (isErr(result)) {
				// TypeScript should know result.error is a string
				const error: string = result.error;
				expect(error).toBe('failed');
			}
		});
	});

	describe('mapResult', () => {
		it('should transform Ok values', () => {
			const result = Ok(5);
			const mapped = mapResult(result, (x) => x * 2);
			expect(mapped).toEqual(Ok(10));
		});

		it('should not transform Err values', () => {
			const result: Result<number, string> = Err('error');
			const mapped = mapResult(result, (x) => x * 2);
			expect(mapped).toEqual(Err('error'));
		});

		it('should work with type transformations', () => {
			const result = Ok(42);
			const mapped = mapResult(result, (x) => `value: ${x}`);
			expect(mapped).toEqual(Ok('value: 42'));
		});

		it('should chain multiple maps', () => {
			const result = Ok(5);
			const mapped = mapResult(
				mapResult(result, (x) => x * 2),
				(x) => x + 1
			);
			expect(mapped).toEqual(Ok(11));
		});
	});

	describe('mapErr', () => {
		it('should transform Err values', () => {
			const result: Result<number, string> = Err('error');
			const mapped = mapErr(result, (e) => e.toUpperCase());
			expect(mapped).toEqual(Err('ERROR'));
		});

		it('should not transform Ok values', () => {
			const result: Result<number, string> = Ok(42);
			const mapped = mapErr(result, (e) => e.toUpperCase());
			expect(mapped).toEqual(Ok(42));
		});

		it('should work with error type transformations', () => {
			const result: Result<number, string> = Err('not found');
			const mapped = mapErr(result, (e) => ({ code: 404, message: e }));
			expect(mapped).toEqual(Err({ code: 404, message: 'not found' }));
		});
	});

	describe('flatMap', () => {
		it('should chain Result-returning operations on Ok', () => {
			const result = Ok(5);
			const chained = flatMap(result, (x) => Ok(x * 2));
			expect(chained).toEqual(Ok(10));
		});

		it('should not execute function on Err', () => {
			const result: Result<number, string> = Err('error');
			const chained = flatMap(result, (x) => Ok(x * 2));
			expect(chained).toEqual(Err('error'));
		});

		it('should propagate errors from chained operations', () => {
			const result = Ok(5);
			const chained = flatMap(result, (x) => Err(`failed at ${x}`));
			expect(chained).toEqual(Err('failed at 5'));
		});

		it('should allow complex chains', () => {
			const divide = (a: number, b: number): Result<number, string> =>
				b === 0 ? Err('division by zero') : Ok(a / b);

			const result = flatMap(Ok(10), (x) => flatMap(divide(x, 2), (y) => divide(y, 0)));

			expect(result).toEqual(Err('division by zero'));
		});
	});

	describe('unwrap', () => {
		it('should return value for Ok results', () => {
			const result = Ok(42);
			expect(unwrap(result)).toBe(42);
		});

		it('should throw for Err results', () => {
			const result = Err('error');
			expect(() => unwrap(result)).toThrow();
		});

		it('should include error in thrown message', () => {
			const result = Err({ code: 404, message: 'not found' });
			expect(() => unwrap(result)).toThrow('not found');
		});
	});

	describe('unwrapOr', () => {
		it('should return value for Ok results', () => {
			const result = Ok(42);
			expect(unwrapOr(result, 0)).toBe(42);
		});

		it('should return default for Err results', () => {
			const result: Result<number, string> = Err('error');
			expect(unwrapOr(result, 0)).toBe(0);
		});

		it('should work with complex default values', () => {
			const result: Result<{ x: number }, string> = Err('error');
			expect(unwrapOr(result, { x: -1 })).toEqual({ x: -1 });
		});
	});

	describe('real-world scenarios', () => {
		it('should handle parsing operations', () => {
			const parseNumber = (str: string): Result<number, string> => {
				const num = Number(str);
				return Number.isNaN(num) ? Err('not a number') : Ok(num);
			};

			expect(parseNumber('42')).toEqual(Ok(42));
			expect(parseNumber('abc')).toEqual(Err('not a number'));
		});

		it('should handle validation chains', () => {
			const validatePositive = (n: number): Result<number, string> =>
				n > 0 ? Ok(n) : Err('must be positive');

			const validateLessThan100 = (n: number): Result<number, string> =>
				n < 100 ? Ok(n) : Err('must be less than 100');

			const validate = (n: number) => flatMap(validatePositive(n), validateLessThan100);

			expect(validate(50)).toEqual(Ok(50));
			expect(validate(-5)).toEqual(Err('must be positive'));
			expect(validate(150)).toEqual(Err('must be less than 100'));
		});
	});
});
