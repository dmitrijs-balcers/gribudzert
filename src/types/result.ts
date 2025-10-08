/**
 * Result type for operations that can fail
 * Represents either success (Ok) or failure (Err)
 */
export type Result<T, E> =
	| { readonly kind: 'ok'; readonly value: T }
	| { readonly kind: 'error'; readonly error: E };

/**
 * Create a successful Result
 */
export const Ok = <T, E = never>(value: T): Result<T, E> => ({
	kind: 'ok',
	value,
});

/**
 * Create a failed Result
 */
export const Err = <T = never, E = unknown>(error: E): Result<T, E> => ({
	kind: 'error',
	error,
});

/**
 * Type guard to check if Result is Ok
 */
export const isOk = <T, E>(
	result: Result<T, E>
): result is Extract<Result<T, E>, { kind: 'ok' }> => {
	return result.kind === 'ok';
};

/**
 * Type guard to check if Result is Err
 */
export const isErr = <T, E>(
	result: Result<T, E>
): result is Extract<Result<T, E>, { kind: 'error' }> => {
	return result.kind === 'error';
};

/**
 * Map over a successful Result's value
 */
export const mapResult = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> => {
	if (isOk(result)) {
		return Ok(fn(result.value));
	}
	return result;
};

/**
 * Map over a failed Result's error
 */
export const mapErr = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> => {
	if (isErr(result)) {
		return Err(fn(result.error));
	}
	return result;
};

/**
 * Chain Result-returning operations
 */
export const flatMap = <T, U, E>(
	result: Result<T, E>,
	fn: (value: T) => Result<U, E>
): Result<U, E> => {
	if (isOk(result)) {
		return fn(result.value);
	}
	return result;
};

/**
 * Unwrap a Result, throwing if it's an error
 * Use sparingly - prefer pattern matching with isOk/isErr
 */
export const unwrap = <T, E>(result: Result<T, E>): T => {
	if (isOk(result)) {
		return result.value;
	}
	throw new Error(`Attempted to unwrap an error: ${JSON.stringify(result.error)}`);
};

/**
 * Unwrap a Result, returning a default value if it's an error
 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
	if (isOk(result)) {
		return result.value;
	}
	return defaultValue;
};
