import type { OfflineRuntime } from './runtime';

export type ExtendableContext = { readonly waitUntil: (task: Promise<unknown>) => void };

export type FetchContext = ExtendableContext & {
	readonly request: Request;
	readonly respondWith: (response: Promise<Response> | Response) => void;
};

export type ServiceWorkerHost = {
	readonly addEventListener: {
		(type: 'install', listener: (event: ExtendableContext) => void): void;
		(type: 'activate', listener: (event: ExtendableContext) => void): void;
		(type: 'fetch', listener: (event: FetchContext) => void): void;
	};
	readonly clients: { readonly claim: () => Promise<void> };
	readonly location: { readonly origin: string };
};

export const installServiceWorker = (host: ServiceWorkerHost, runtime: OfflineRuntime): void => {
	host.addEventListener('install', (event) => {
		event.waitUntil(runtime.install());
	});
	host.addEventListener('activate', (event) => {
		event.waitUntil(runtime.activate().then(() => host.clients.claim()));
	});
	host.addEventListener('fetch', (event) => {
		const handled = runtime.fetch(event);
		if (handled !== null) {
			event.respondWith(handled);
		}
	});
};
