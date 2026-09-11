export type UmamiEventData = Readonly<Record<string, string | number | boolean>>;

export interface UmamiTrackFunction {
	(): void;
	(eventName: string): void;
	(eventName: string, data: UmamiEventData): void;
}

export interface UmamiTracker {
	readonly track: UmamiTrackFunction;
}

declare global {
	interface Window {
		umami?: UmamiTracker;
	}
}

export const isUmamiAvailable = (umami: unknown): umami is UmamiTracker =>
	typeof umami === 'object' &&
	umami !== null &&
	'track' in umami &&
	typeof (umami as UmamiTracker).track === 'function';
