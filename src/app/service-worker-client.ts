import { SERVICE_WORKER_PATH } from '../core/config';
import * as logger from '../utils/logger';

export const registerServiceWorker = (): void => {
	if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
		return;
	}
	void navigator.serviceWorker.register(SERVICE_WORKER_PATH).catch((error: unknown) => {
		logger.error('Service worker registration failed', error);
	});
};
