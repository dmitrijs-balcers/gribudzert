import type * as L from 'leaflet';
import { point as leafletPoint } from 'leaflet';
import { timestampNow } from '../../domain';
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

	const containerPointOf = (event: PointerEvent): GesturePoint => {
		const rect = map.getContainer().getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	};

	const runEffect = (effect: GestureEffect): void => {
		switch (effect.kind) {
			case 'begin':
				map.dragging.disable();
				map.getContainer().classList.add(GESTURE_ACTIVE_CLASS);
				notifyUserMovedMap();
				return;
			case 'zoomTo':
				map.setZoomAround(leafletPoint(effect.anchor.x, effect.anchor.y), effect.zoom, {
					animate: false,
				});
				return;
			case 'end':
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

	const onPointerMove = (event: PointerEvent): void => {
		if (!activePointerIds.has(event.pointerId)) {
			return;
		}
		const point = containerPointOf(event);
		dispatch({ kind: 'pointerMove', x: point.x, y: point.y, pointerCount: activePointerIds.size });
	};

	const onPointerUp = (event: PointerEvent): void => {
		activePointerIds.delete(event.pointerId);
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
			const container = map.getContainer();
			container.addEventListener('pointerdown', onPointerDown);
			container.addEventListener('pointermove', onPointerMove, { passive: false });
			container.addEventListener('pointerup', onPointerUp);
			container.addEventListener('pointercancel', onPointerCancel);
		},
		disable: () => {
			if (!enabled) {
				return;
			}
			enabled = false;
			const container = map.getContainer();
			container.removeEventListener('pointerdown', onPointerDown);
			container.removeEventListener('pointermove', onPointerMove);
			container.removeEventListener('pointerup', onPointerUp);
			container.removeEventListener('pointercancel', onPointerCancel);
			activePointerIds.clear();
			state = idleGestureState;
		},
	};
};
