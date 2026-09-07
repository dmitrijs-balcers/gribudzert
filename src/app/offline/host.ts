import type { OfflineRuntime } from './runtime';

export type ExtendableContext = { readonly waitUntil: (task: Promise<unknown>) => void };

export type FetchContext = ExtendableContext & {
	readonly request: Request;
	readonly respondWith: (response: Promise<Response> | Response) => void;
};

export type MessageContext = { readonly data: unknown };

export type ServiceWorkerHost = {
	readonly addEventListener: {
		(type: 'install', listener: (event: ExtendableContext) => void): void;
		(type: 'activate', listener: (event: ExtendableContext) => void): void;
		(type: 'fetch', listener: (event: FetchContext) => void): void;
		(type: 'message', listener: (event: MessageContext) => void): void;
	};
	readonly clients: { readonly claim: () => Promise<void> };
	readonly location: { readonly origin: string };
	readonly skipWaiting: () => Promise<void>;
};

const SKIP_WAITING_MESSAGE_TYPE = 'SKIP_WAITING';

const isSkipWaitingMessage = (data: unknown): boolean =>
	typeof data === 'object' &&
	data !== null &&
	'type' in data &&
	data.type === SKIP_WAITING_MESSAGE_TYPE;

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
	host.addEventListener('message', (event) => {
		if (isSkipWaitingMessage(event.data)) {
			void host.skipWaiting();
		}
	});
};
