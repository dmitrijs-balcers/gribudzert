import type { Connectivity } from '../../domain';

export const currentConnectivity = (nav: Navigator): Connectivity =>
	nav.onLine ? 'online' : 'offline';

export const observeConnectivity = (
	target: EventTarget,
	nav: Navigator,
	onChange: (connectivity: Connectivity) => void
): (() => void) => {
	const report = (): void => {
		onChange(currentConnectivity(nav));
	};
	target.addEventListener('online', report);
	target.addEventListener('offline', report);
	return () => {
		target.removeEventListener('online', report);
		target.removeEventListener('offline', report);
	};
};
