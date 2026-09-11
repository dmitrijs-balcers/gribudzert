export type DebouncedFn<T extends (...args: never[]) => void> = T & {
	readonly cancel: () => void;
};

export const debounce = <T extends (...args: never[]) => void>(
	fn: T,
	ms: number
): DebouncedFn<T> => {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const cancel = (): void => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
	};

	const debounced = ((...args: Parameters<T>): void => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
		}
		timeoutId = setTimeout(() => {
			fn(...args);
			timeoutId = null;
		}, ms);
	}) as T & { cancel: () => void };

	debounced.cancel = cancel;

	return debounced as DebouncedFn<T>;
};
