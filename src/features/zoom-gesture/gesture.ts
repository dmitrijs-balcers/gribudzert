import {
	ONE_HAND_ZOOM_DRAG_THRESHOLD_PX,
	ONE_HAND_ZOOM_PX_PER_ZOOM_LEVEL,
	ONE_HAND_ZOOM_TAP_INTERVAL_MS,
	ONE_HAND_ZOOM_TAP_SLOP_PX,
} from '../../core/config';
import type { Timestamp } from '../../domain';

export type GesturePoint = {
	readonly x: number;
	readonly y: number;
};

export type GestureState =
	| { readonly kind: 'idle' }
	| {
			readonly kind: 'firstTapDown';
			readonly x: number;
			readonly y: number;
			readonly at: Timestamp;
	  }
	| { readonly kind: 'firstTapUp'; readonly x: number; readonly y: number; readonly at: Timestamp }
	| { readonly kind: 'armed'; readonly anchor: GesturePoint; readonly baseZoom: number }
	| { readonly kind: 'dragging'; readonly anchor: GesturePoint; readonly baseZoom: number };

export const idleGestureState: GestureState = { kind: 'idle' };

export type GestureEvent =
	| {
			readonly kind: 'pointerDown';
			readonly x: number;
			readonly y: number;
			readonly pointerCount: number;
			readonly zoom: number;
	  }
	| {
			readonly kind: 'pointerMove';
			readonly x: number;
			readonly y: number;
			readonly pointerCount: number;
	  }
	| { readonly kind: 'pointerUp'; readonly pointerCount: number }
	| { readonly kind: 'cancel' };

export type GestureEffect =
	| { readonly kind: 'begin'; readonly anchor: GesturePoint }
	| { readonly kind: 'zoomTo'; readonly zoom: number }
	| { readonly kind: 'end' };

type Reduction = readonly [GestureState, readonly GestureEffect[]];

const noEffects = (state: GestureState): Reduction => [state, []];

const distanceBetween = (a: GesturePoint, b: GesturePoint): number =>
	Math.hypot(a.x - b.x, a.y - b.y);

const zoomFor = (anchor: GesturePoint, baseZoom: number, currentY: number): number =>
	baseZoom + (currentY - anchor.y) / ONE_HAND_ZOOM_PX_PER_ZOOM_LEVEL;

const reduceIdle = (event: GestureEvent, now: Timestamp): Reduction => {
	if (event.kind === 'pointerDown' && event.pointerCount === 1) {
		return [{ kind: 'firstTapDown', x: event.x, y: event.y, at: now }, []];
	}
	return noEffects(idleGestureState);
};

const reduceFirstTapDown = (
	state: Extract<GestureState, { readonly kind: 'firstTapDown' }>,
	event: GestureEvent,
	now: Timestamp
): Reduction => {
	switch (event.kind) {
		case 'pointerDown':
			return event.pointerCount > 1 ? noEffects(idleGestureState) : noEffects(state);
		case 'pointerMove':
			if (event.pointerCount > 1) {
				return noEffects(idleGestureState);
			}
			if (distanceBetween(state, { x: event.x, y: event.y }) > ONE_HAND_ZOOM_TAP_SLOP_PX) {
				return noEffects(idleGestureState);
			}
			return noEffects(state);
		case 'pointerUp':
			return [{ kind: 'firstTapUp', x: state.x, y: state.y, at: now }, []];
		case 'cancel':
			return noEffects(idleGestureState);
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
};

const reduceFirstTapUp = (
	state: Extract<GestureState, { readonly kind: 'firstTapUp' }>,
	event: GestureEvent,
	now: Timestamp
): Reduction => {
	switch (event.kind) {
		case 'pointerDown': {
			if (event.pointerCount > 1) {
				return noEffects(idleGestureState);
			}
			const withinInterval = now - state.at <= ONE_HAND_ZOOM_TAP_INTERVAL_MS;
			const withinSlop =
				distanceBetween(state, { x: event.x, y: event.y }) <= ONE_HAND_ZOOM_TAP_SLOP_PX;
			if (!withinInterval || !withinSlop) {
				return [{ kind: 'firstTapDown', x: event.x, y: event.y, at: now }, []];
			}
			const anchor = { x: event.x, y: event.y };
			return [{ kind: 'armed', anchor, baseZoom: event.zoom }, [{ kind: 'begin', anchor }]];
		}
		case 'pointerMove':
		case 'pointerUp':
			return noEffects(state);
		case 'cancel':
			return noEffects(idleGestureState);
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
};

const reduceArmed = (
	state: Extract<GestureState, { readonly kind: 'armed' }>,
	event: GestureEvent
): Reduction => {
	switch (event.kind) {
		case 'pointerDown':
			return event.pointerCount > 1 ? [idleGestureState, [{ kind: 'end' }]] : noEffects(state);
		case 'pointerMove': {
			if (event.pointerCount > 1) {
				return [idleGestureState, [{ kind: 'end' }]];
			}
			const moved = { x: event.x, y: event.y };
			if (distanceBetween(state.anchor, moved) < ONE_HAND_ZOOM_DRAG_THRESHOLD_PX) {
				return noEffects(state);
			}
			const zoom = zoomFor(state.anchor, state.baseZoom, event.y);
			return [
				{ kind: 'dragging', anchor: state.anchor, baseZoom: state.baseZoom },
				[{ kind: 'zoomTo', zoom }],
			];
		}
		case 'pointerUp':
		case 'cancel':
			return [idleGestureState, [{ kind: 'end' }]];
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
};

const reduceDragging = (
	state: Extract<GestureState, { readonly kind: 'dragging' }>,
	event: GestureEvent
): Reduction => {
	switch (event.kind) {
		case 'pointerDown':
			return event.pointerCount > 1 ? [idleGestureState, [{ kind: 'end' }]] : noEffects(state);
		case 'pointerMove': {
			if (event.pointerCount > 1) {
				return [idleGestureState, [{ kind: 'end' }]];
			}
			const zoom = zoomFor(state.anchor, state.baseZoom, event.y);
			return [state, [{ kind: 'zoomTo', zoom }]];
		}
		case 'pointerUp':
		case 'cancel':
			return [idleGestureState, [{ kind: 'end' }]];
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
};

export const reduce = (state: GestureState, event: GestureEvent, now: Timestamp): Reduction => {
	switch (state.kind) {
		case 'idle':
			return reduceIdle(event, now);
		case 'firstTapDown':
			return reduceFirstTapDown(state, event, now);
		case 'firstTapUp':
			return reduceFirstTapUp(state, event, now);
		case 'armed':
			return reduceArmed(state, event);
		case 'dragging':
			return reduceDragging(state, event);
		default: {
			const exhaustive: never = state;
			return exhaustive;
		}
	}
};
