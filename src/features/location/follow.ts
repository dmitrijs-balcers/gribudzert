import type * as L from 'leaflet';
import { LOCATE_ZOOM } from '../../core/config';
import type { LatLon } from '../../domain';
import type { LocationTracker } from './tracker';

export type FollowMode = 'off' | 'on';

export type FollowTransition = 'flyTo' | 'setView';

export type FollowController = {
	readonly follow: (transition: FollowTransition) => void;
	readonly unfollow: () => void;
	readonly mode: () => FollowMode;
};

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const isArrowKey = (event: KeyboardEvent): boolean => ARROW_KEYS.has(event.key);

const isSamePlace = (a: LatLon, b: LatLon): boolean => a.lat === b.lat && a.lon === b.lon;

export function createFollowController(
	map: L.Map,
	tracker: LocationTracker,
	onModeChange: (mode: FollowMode) => void
): FollowController {
	let mode: FollowMode = 'off';
	let pendingTransition: FollowTransition | null = null;
	let centredOn: LatLon | null = null;
	let flying = false;

	const setMode = (next: FollowMode): void => {
		if (mode === next) {
			return;
		}
		mode = next;
		onModeChange(mode);
	};

	const centreOn = (position: LatLon, transition: FollowTransition): void => {
		centredOn = position;
		const target: L.LatLngTuple = [position.lat, position.lon];
		switch (transition) {
			case 'setView':
				map.setView(target, map.getZoom());
				return;
			case 'flyTo':
				flying = true;
				map.once('moveend', () => {
					flying = false;
				});
				map.flyTo(target, Math.max(map.getZoom(), LOCATE_ZOOM));
				return;
			default: {
				const exhaustive: never = transition;
				throw new Error(`Unhandled follow transition: ${JSON.stringify(exhaustive)}`);
			}
		}
	};

	const keepCentred = (position: LatLon): void => {
		if (pendingTransition !== null) {
			const transition = pendingTransition;
			pendingTransition = null;
			centreOn(position, transition);
			return;
		}
		if (flying || (centredOn !== null && isSamePlace(centredOn, position))) {
			return;
		}
		centredOn = position;
		map.panTo([position.lat, position.lon], { animate: true, duration: 0.5 });
	};

	const leaveFollowMode = (): void => {
		pendingTransition = null;
		setMode('off');
	};

	tracker.subscribe((state) => {
		if (mode === 'on' && state.kind === 'tracking') {
			keepCentred(state.position);
		}
	});

	map.on('dragstart', leaveFollowMode);

	document.addEventListener('keydown', (event: KeyboardEvent) => {
		if (isArrowKey(event) && document.activeElement === map.getContainer()) {
			leaveFollowMode();
		}
	});

	return {
		follow: (transition) => {
			setMode('on');
			const state = tracker.state();
			if (state.kind === 'tracking') {
				pendingTransition = null;
				centreOn(state.position, transition);
			} else {
				pendingTransition = transition;
			}
		},
		unfollow: leaveFollowMode,
		mode: () => mode,
	};
}
