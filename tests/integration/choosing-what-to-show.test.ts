import { fireEvent, waitFor } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { isToiletQuery } from '../fixtures';
import { renderApp } from '../harness';

describe('Choosing what to show on the map', () => {
	it('replaces the default Leaflet layer control with a layer picker button under the locate button', async () => {
		const app = await renderApp();

		expect(app.container.querySelector('.leaflet-control-layers')).toBeNull();

		const stack = app.container.querySelector('.leaflet-top.leaflet-right');
		const controls = Array.from(stack?.querySelectorAll('.leaflet-control') ?? []);
		const locateIndex = controls.findIndex((control) =>
			control.classList.contains('locate-control')
		);
		const pickerIndex = controls.findIndex((control) => control.classList.contains('layer-picker'));
		expect(locateIndex).toBeGreaterThanOrEqual(0);
		expect(pickerIndex).toBe(locateIndex + 1);

		const button = app.container.querySelector('.layer-picker-button');
		expect(button).not.toBeNull();

		const popover = app.container.querySelector('.layer-picker-popover');
		expect((popover as HTMLElement | null)?.hidden).toBe(true);
	});

	it('opens on click with the three layer switches in order and the correct initial state', async () => {
		const app = await renderApp();

		const button = app.container.querySelector('.layer-picker-button');
		fireEvent.click(button as HTMLButtonElement);

		const popover = app.container.querySelector('.layer-picker-popover') as HTMLElement;
		expect(popover.hidden).toBe(false);
		expect(button?.getAttribute('aria-expanded')).toBe('true');

		const tiles = Array.from(popover.querySelectorAll('.layer-picker-tile'));
		expect(
			tiles.map((tile) => tile.querySelector('.layer-picker-tile-label')?.textContent?.trim())
		).toEqual(['Drinking Points', 'Public Toilets', 'Viewpoints']);
		expect(tiles.map((tile) => tile.getAttribute('aria-checked'))).toEqual([
			'true',
			'false',
			'false',
		]);
	});

	it('toggling Public Toilets fires the Overpass request for toilets and flips the tile on', async () => {
		const app = await renderApp();

		app.toggleLayer('Public Toilets');

		await waitFor(() =>
			expect(app.overpass.requests.some((request) => isToiletQuery(request.query))).toBe(true)
		);
		expect(app.isLayerOn('Public Toilets')).toBe(true);
	});

	it('closes on Escape and returns focus to the button', async () => {
		const app = await renderApp();
		const button = app.container.querySelector('.layer-picker-button') as HTMLButtonElement;
		fireEvent.click(button);

		const popover = app.container.querySelector('.layer-picker-popover') as HTMLElement;
		expect(popover.hidden).toBe(false);

		fireEvent.keyDown(document, { key: 'Escape' });

		expect(popover.hidden).toBe(true);
		expect(document.activeElement).toBe(button);
	});

	it('closes when clicking the map outside the popover', async () => {
		const app = await renderApp();
		const button = app.container.querySelector('.layer-picker-button') as HTMLButtonElement;
		fireEvent.click(button);

		const popover = app.container.querySelector('.layer-picker-popover') as HTMLElement;
		expect(popover.hidden).toBe(false);

		fireEvent.click(app.container);

		expect(popover.hidden).toBe(true);
	});
});
