import { describe, expect, it } from 'vitest';
import {
	Err,
	flatMap,
	isErr,
	isOk,
	mapErr,
	mapResult,
	Ok,
	type Result,
	unwrap,
	unwrapOr,
} from '../../../src/types/result';

describe('Result Type', () => {
	describe('Ok constructor', () => {
		it('should create an Ok result with a value', () => {
			const result = Ok(42);
			expect(result.kind).toBe('ok');
			expect(result.value).toBe(42);
		});

		it('should create Ok with string values', () => {
			const result = Ok('success');
			expect(result.kind).toBe('ok');
			expect(result.value).toBe('success');
		});

		it('should create Ok with object values', () => {
			const result = Ok({ name: 'test' });
			expect(result.kind).toBe('ok');
			expect(result.value).toEqual({ name: 'test' });
		});
	});

	describe('Err constructor', () => {
		it('should create an Err result with an error', () => {
			const result = Err('error message');
			expect(result.kind).toBe('error');
			expect(result.error).toBe('error message');
		});

		it('should create Err with Error objects', () => {
			const error = new Error('Something went wrong');
			const result = Err(error);
			expect(result.kind).toBe('error');
			expect(result.error).toBe(error);
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

		it('should narrow type correctly', () => {
			const result: Result<number, string> = Ok(42);
			if (isOk(result)) {
				// TypeScript should know result.value exists
				expect(result.value).toBe(42);
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

		it('should narrow type correctly', () => {
			const result: Result<number, string> = Err('error');
			if (isErr(result)) {
				// TypeScript should know result.error exists
				expect(result.error).toBe('error');
			}
		});
	});

	describe('mapResult', () => {
		it('should transform Ok values', () => {
			const result = Ok(42);
			const mapped = mapResult(result, (x) => x * 2);
			expect(isOk(mapped)).toBe(true);
			if (isOk(mapped)) {
				expect(mapped.value).toBe(84);
			}
		});

		it('should not transform Err values', () => {
			const result = Err<number, string>('error');
			const mapped = mapResult(result, (x) => x * 2);
			expect(isErr(mapped)).toBe(true);
			if (isErr(mapped)) {
				expect(mapped.error).toBe('error');
			}
		});

		it('should change the value type', () => {
			const result = Ok(42);
			const mapped = mapResult(result, (x) => x.toString());
			expect(isOk(mapped)).toBe(true);
			if (isOk(mapped)) {
				expect(mapped.value).toBe('42');
			}
		});
	});

	describe('mapErr', () => {
		it('should transform Err values', () => {
			const result = Err('error');
			const mapped = mapErr(result, (e) => e.toUpperCase());
			expect(isErr(mapped)).toBe(true);
			if (isErr(mapped)) {
				expect(mapped.error).toBe('ERROR');
			}
		});

		it('should not transform Ok values', () => {
			const result = Ok<number, string>(42);
			const mapped = mapErr(result, (e) => e.toUpperCase());
			expect(isOk(mapped)).toBe(true);
			if (isOk(mapped)) {
				expect(mapped.value).toBe(42);
			}
		});
	});

	describe('flatMap', () => {
		it('should chain Ok results', () => {
			const result = Ok(42);
			const chained = flatMap(result, (x) => Ok(x * 2));
			expect(isOk(chained)).toBe(true);
			if (isOk(chained)) {
				expect(chained.value).toBe(84);
			}
		});

		it('should not chain Err results', () => {
			const result = Err<number, string>('error');
			const chained = flatMap(result, (x) => Ok(x * 2));
			expect(isErr(chained)).toBe(true);
			if (isErr(chained)) {
				expect(chained.error).toBe('error');
			}
		});

		it('should propagate errors from the chained operation', () => {
			const result = Ok(42);
			const chained = flatMap(result, () => Err('new error'));
			expect(isErr(chained)).toBe(true);
			if (isErr(chained)) {
				expect(chained.error).toBe('new error');
			}
		});

		it('should allow multiple chained operations', () => {
			const result = Ok(10);
			const chained = flatMap(
				flatMap(result, (x) => Ok(x + 5)),
				(x) => Ok(x * 2)
			);
			expect(isOk(chained)).toBe(true);
			if (isOk(chained)) {
				expect(chained.value).toBe(30);
			}
		});
	});

	describe('unwrap', () => {
		it('should return the value for Ok results', () => {
			const result = Ok(42);
			expect(unwrap(result)).toBe(42);
		});

		it('should throw for Err results', () => {
			const result = Err('error message');
			expect(() => unwrap(result)).toThrow('Attempted to unwrap an error');
		});
	});

	describe('unwrapOr', () => {
		it('should return the value for Ok results', () => {
			const result = Ok(42);
			expect(unwrapOr(result, 0)).toBe(42);
		});

		it('should return the default value for Err results', () => {
			const result = Err<number, string>('error');
			expect(unwrapOr(result, 0)).toBe(0);
		});
	});

	describe('real-world usage patterns', () => {
		it('should handle async operations', () => {
			const parseNumber = (str: string): Result<number, string> => {
				const num = Number.parseInt(str, 10);
				return Number.isNaN(num) ? Err('Not a number') : Ok(num);
			};

			const result1 = parseNumber('42');
			expect(isOk(result1)).toBe(true);
			if (isOk(result1)) {
				expect(result1.value).toBe(42);
			}

			const result2 = parseNumber('abc');
			expect(isErr(result2)).toBe(true);
			if (isErr(result2)) {
				expect(result2.error).toBe('Not a number');
			}
		});

		it('should compose multiple operations', () => {
			const divide = (a: number, b: number): Result<number, string> =>
				b === 0 ? Err('Division by zero') : Ok(a / b);

			const sqrt = (x: number): Result<number, string> =>
				x < 0 ? Err('Negative number') : Ok(Math.sqrt(x));

			const result = flatMap(divide(16, 4), sqrt);
			expect(isOk(result)).toBe(true);
			if (isOk(result)) {
				expect(result.value).toBe(2);
			}

			const errorResult = flatMap(divide(10, 0), sqrt);
			expect(isErr(errorResult)).toBe(true);
			if (isErr(errorResult)) {
				expect(errorResult.error).toBe('Division by zero');
			}
		});
	});
});
