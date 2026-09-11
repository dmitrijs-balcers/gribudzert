import { describe, expect, it } from 'vitest';
import { ONE_HAND_ZOOM_DRAG_THRESHOLD_PX, ONE_HAND_ZOOM_TAP_SLOP_PX } from '../../src/core/config';
import type { Timestamp } from '../../src/domain';
import type { GestureEvent, GestureState } from '../../src/features/zoom-gesture/gesture';
import { idleGestureState, reduce } from '../../src/features/zoom-gesture/gesture';

const NOW = 1_000 as Timestamp;
const TAP = { x: 300, y: 200 };

const down = (point: { x: number; y: number }): GestureEvent => ({
	kind: 'pointerDown',
	x: point.x,
	y: point.y,
	pointerCount: 1,
	zoom: 14,
});
const up: GestureEvent = { kind: 'pointerUp', pointerCount: 0 };

const afterFirstTap = (): GestureState => {
	const [pressed] = reduce(idleGestureState, down(TAP), NOW);
	const [released] = reduce(pressed, up, NOW);
	return released;
};

describe('One-hand zoom gesture reducer', () => {
	it('zooms in around the second tap when it lifts without sliding', () => {
		const [armed] = reduce(afterFirstTap(), down(TAP), NOW);
		const [state, effects] = reduce(armed, up, NOW);

		expect(state).toEqual(idleGestureState);
		expect(effects).toEqual([{ kind: 'end' }, { kind: 'tapZoomIn', anchor: TAP }]);
	});

	it('does not zoom in when the second tap slid before lifting', () => {
		const [armed] = reduce(afterFirstTap(), down(TAP), NOW);
		const [dragging] = reduce(
			armed,
			{
				kind: 'pointerMove',
				x: TAP.x,
				y: TAP.y + ONE_HAND_ZOOM_DRAG_THRESHOLD_PX,
				pointerCount: 1,
			},
			NOW
		);
		const [state, effects] = reduce(dragging, up, NOW);

		expect(state).toEqual(idleGestureState);
		expect(effects).toEqual([{ kind: 'end' }]);
	});

	it('does not zoom in when the second tap lands too far from the first', () => {
		const far = { x: TAP.x + ONE_HAND_ZOOM_TAP_SLOP_PX + 1, y: TAP.y };
		const [state, effects] = reduce(afterFirstTap(), down(far), NOW);

		expect(state.kind).toBe('firstTapDown');
		expect(effects).toEqual([]);
	});
});
