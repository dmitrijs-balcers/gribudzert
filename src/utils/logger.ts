export function info(message: string, ...args: unknown[]): void {
	console.info(message, ...args);
}

export function warn(message: string, ...args: unknown[]): void {
	console.warn(message, ...args);
}

export function error(message: string, ...args: unknown[]): void {
	console.error(message, ...args);
}
