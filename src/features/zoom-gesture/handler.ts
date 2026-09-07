import type * as L from 'leaflet';
import { timestampNow } from '../../domain';
import { createContinuousZoom } from './continuous-zoom';
import type { GestureEffect, GestureEvent, GesturePoint, GestureState } from './gesture';
import { idleGestureState, reduce } from './gesture';

export type OneHandZoomHandler = {
	readonly enable: () => void;
	readonly disable: () => void;
};

const GESTURE_ACTIVE_CLASS = 'one-hand-zoom-active';

export const createOneHandZoomHandler = (
	map: L.Map,
	notifyUserMovedMap: () => void = () => undefined
): OneHandZoomHandler => {
	let state: GestureState = idleGestureState;
	let enabled = false;
	const activePointerIds = new Set<number>();
	const zoom = createContinuousZoom(map);

	const containerPointOf = (event: PointerEvent): GesturePoint => {
		const rect = map.getContainer().getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	};

	const runEffect = (effect: GestureEffect): void => {
		switch (effect.kind) {
			case 'begin':
				map.dragging.disable();
				map.getContainer().classList.add(GESTURE_ACTIVE_CLASS);
				zoom.start(effect.anchor);
				notifyUserMovedMap();
				return;
			case 'zoomTo':
				zoom.zoomTo(effect.zoom);
				return;
			case 'end':
				zoom.finish();
				map.dragging.enable();
				map.getContainer().classList.remove(GESTURE_ACTIVE_CLASS);
				return;
			default: {
				const exhaustive: never = effect;
				throw new Error(`Unhandled one-hand zoom effect: ${JSON.stringify(exhaustive)}`);
			}
		}
	};

	const dispatch = (event: GestureEvent): void => {
		const [nextState, effects] = reduce(state, event, timestampNow());
		state = nextState;
		for (const effect of effects) {
			runEffect(effect);
		}
	};

	const onPointerDown = (event: PointerEvent): void => {
		activePointerIds.add(event.pointerId);
		const point = containerPointOf(event);
		dispatch({
			kind: 'pointerDown',
			x: point.x,
			y: point.y,
			pointerCount: activePointerIds.size,
			zoom: map.getZoom(),
		});
	};

	// Move, up and cancel are heard on the window: a finger that slides off the map container
	// (or lifts there) must still finish the gesture, otherwise dragging stays disabled.
	const onPointerMove = (event: PointerEvent): void => {
		if (!activePointerIds.has(event.pointerId)) {
			return;
		}
		const point = containerPointOf(event);
		dispatch({ kind: 'pointerMove', x: point.x, y: point.y, pointerCount: activePointerIds.size });
	};

	const onPointerUp = (event: PointerEvent): void => {
		if (!activePointerIds.delete(event.pointerId)) {
			return;
		}
		dispatch({ kind: 'pointerUp', pointerCount: activePointerIds.size });
	};

	const onPointerCancel = (): void => {
		activePointerIds.clear();
		dispatch({ kind: 'cancel' });
	};

	return {
		enable: () => {
			if (enabled) {
				return;
			}
			enabled = true;
			map.getContainer().addEventListener('pointerdown', onPointerDown);
			window.addEventListener('pointermove', onPointerMove);
			window.addEventListener('pointerup', onPointerUp);
			window.addEventListener('pointercancel', onPointerCancel);
		},
		disable: () => {
			if (!enabled) {
				return;
			}
			enabled = false;
			map.getContainer().removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', onPointerCancel);
			activePointerIds.clear();
			dispatch({ kind: 'cancel' });
		},
	};
};
