/**
 * On a phone, one hand can hold the phone or slide a finger, but not both hands pinch.
 * A quick double tap that keeps the second finger down and slides turns into a zoom:
 * down zooms in, up zooms out, anchored on the second tap.
 */

import { waitFor } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM } from '../../src/core/config';
import type { AppHandle } from '../harness';
import { renderApp } from '../harness';

const TAP_POINT = { x: 300, y: 200 };

const doubleTapThenSlideTo = (app: AppHandle, target: { x: number; y: number }): void => {
	app.gesturePointer('pointerdown', TAP_POINT);
	app.gesturePointer('pointerup', TAP_POINT);
	app.gesturePointer('pointerdown', TAP_POINT);
	app.gesturePointer('pointermove', { x: target.x, y: TAP_POINT.y + 20 });
	app.gesturePointer('pointermove', target);
};

const plainDoubleTap = (app: AppHandle): void => {
	app.gesturePointer('pointerdown', TAP_POINT);
	app.gesturePointer('pointerup', TAP_POINT);
	app.gesturePointer('pointerdown', TAP_POINT);
	app.gesturePointer('pointerup', TAP_POINT);
};

describe('One-hand zoom on mobile', () => {
	it('zooms in while sliding down from the second tap', async () => {
		const app = await renderApp({ pointer: 'coarse' });
		await waitFor(() => expect(app.tileZoom()).toBe(DEFAULT_ZOOM));

		doubleTapThenSlideTo(app, { x: TAP_POINT.x, y: TAP_POINT.y + 150 });

		await waitFor(() => expect(app.tileZoom()).toBe(DEFAULT_ZOOM + 1));

		app.gesturePointer('pointerup', TAP_POINT);
		expect(app.draggingEnabled()).toBe(true);
	});

	it('zooms out while sliding up from the second tap', async () => {
		const app = await renderApp({ pointer: 'coarse' });
		await waitFor(() => expect(app.tileZoom()).toBe(DEFAULT_ZOOM));

		doubleTapThenSlideTo(app, { x: TAP_POINT.x, y: TAP_POINT.y - 150 });

		await waitFor(() => expect(app.tileZoom()).toBe(DEFAULT_ZOOM - 1));

		app.gesturePointer('pointerup', TAP_POINT);
		expect(app.draggingEnabled()).toBe(true);
	});

	it('does nothing custom on a plain double tap that never slides', async () => {
		const app = await renderApp({ pointer: 'coarse' });
		await waitFor(() => expect(app.tileZoom()).toBe(DEFAULT_ZOOM));

		plainDoubleTap(app);

		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(app.tileZoom()).toBe(DEFAULT_ZOOM);
		expect(app.draggingEnabled()).toBe(true);
	});

	it('hides the Leaflet zoom control on a coarse pointer', async () => {
		const app = await renderApp({ pointer: 'coarse' });
		expect(app.zoomControlVisible()).toBe(false);
	});

	it('keeps the Leaflet zoom control on a fine pointer', async () => {
		const app = await renderApp({ pointer: 'fine' });
		expect(app.zoomControlVisible()).toBe(true);
	});

	it('leaves follow mode once the gesture starts', async () => {
		const app = await renderApp({ pointer: 'coarse' });
		await waitFor(() => expect(app.locateButton().getAttribute('data-follow')).toBe('on'));

		app.gesturePointer('pointerdown', TAP_POINT);
		app.gesturePointer('pointerup', TAP_POINT);
		app.gesturePointer('pointerdown', TAP_POINT);

		await waitFor(() => expect(app.locateButton().getAttribute('data-follow')).toBe('off'));

		app.gesturePointer('pointerup', TAP_POINT);
	});
});
