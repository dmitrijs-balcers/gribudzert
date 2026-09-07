import type * as L from 'leaflet';

export type UserInteractionSource = {
	readonly onUserMovedMap: (listener: () => void) => () => void;
	readonly notifyUserMovedMap: () => void;
};

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const isArrowKey = (event: KeyboardEvent): boolean => ARROW_KEYS.has(event.key);

export function createUserInteractionSource(map: L.Map): UserInteractionSource {
	const listeners = new Set<() => void>();

	const notifyUserMovedMap = (): void => {
		for (const listener of listeners) {
			listener();
		}
	};

	map.on('dragstart', notifyUserMovedMap);

	document.addEventListener('keydown', (event: KeyboardEvent) => {
		if (isArrowKey(event) && document.activeElement === map.getContainer()) {
			notifyUserMovedMap();
		}
	});

	return {
		onUserMovedMap: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		notifyUserMovedMap,
	};
}
