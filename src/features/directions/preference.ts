import { DIRECTIONS_APP_STORAGE_KEY } from '../../core/config';
import type { DirectionsApp } from '../../domain';
import { isDirectionsApp } from '../../domain';

export const loadPreferredDirectionsApp = (
	storage: Pick<Storage, 'getItem'>
): DirectionsApp | null => {
	try {
		const raw = storage.getItem(DIRECTIONS_APP_STORAGE_KEY);
		return isDirectionsApp(raw) ? raw : null;
	} catch {
		return null;
	}
};

export const savePreferredDirectionsApp = (
	storage: Pick<Storage, 'setItem'>,
	app: DirectionsApp
): void => {
	try {
		storage.setItem(DIRECTIONS_APP_STORAGE_KEY, app);
	} catch {
		return;
	}
};
