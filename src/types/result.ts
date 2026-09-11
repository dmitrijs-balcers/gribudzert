export type Result<T, E> =
	| { readonly kind: 'ok'; readonly value: T }
	| { readonly kind: 'error'; readonly error: E };

export const Ok = <T, E = never>(value: T): Result<T, E> => ({
	kind: 'ok',
	value,
});

export const Err = <T = never, E = unknown>(error: E): Result<T, E> => ({
	kind: 'error',
	error,
});

export const isOk = <T, E>(
	result: Result<T, E>
): result is Extract<Result<T, E>, { kind: 'ok' }> => {
	return result.kind === 'ok';
};

export const isErr = <T, E>(
	result: Result<T, E>
): result is Extract<Result<T, E>, { kind: 'error' }> => {
	return result.kind === 'error';
};
