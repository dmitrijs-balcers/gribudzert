import { fireEvent, waitFor, within } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { DIRECTIONS_APP_STORAGE_KEY } from '../../src/core/config';
import { NEAREST_TAP_TO_USER, USER, WATER_MARKER_COUNT } from '../fixtures';
import type { AppHandle } from '../harness';
import { renderApp } from '../harness';

type TrackerWindow = Window & { umami?: { track: (...args: unknown[]) => void } };

const IPHONE = { device: 'iphone', geolocation: { position: USER } } as const;

const isNearest = (marker: Element): boolean => marker.classList.contains('nearest-marker');

const openSheetOf = async (app: AppHandle, which: 'nearest' | 'another'): Promise<HTMLElement> => {
	await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
	const index = app
		.markers()
		.findIndex((marker) => (which === 'nearest' ? isNearest(marker) : !isNearest(marker)));
	app.tapMarker(index);
	app.expandSheet();
	const expectedId = which === 'nearest' ? `ID: ${NEAREST_TAP_TO_USER.id}` : 'ID: ';
	await waitFor(() => expect(app.sheetText()).toContain(expectedId));
	const sheet = app.sheet();
	if (sheet === null) {
		throw new Error('Sheet did not open');
	}
	return sheet;
};

const directionsLink = (sheet: HTMLElement): HTMLElement =>
	within(sheet).getByRole('link', { name: /walking directions/ });

const alternativeLink = (sheet: HTMLElement): HTMLElement | null =>
	within(sheet).queryByRole('link', { name: /instead$/ });

const clickWithoutNavigating = (link: HTMLElement): void => {
	link.addEventListener('click', (event) => event.preventDefault(), { once: true });
	fireEvent.click(link);
};

describe('Choosing a maps app for directions on an iPhone', () => {
	it('opens Apple Maps by default and offers OsmAnd as the alternative', async () => {
		const app = await renderApp(IPHONE);
		const sheet = await openSheetOf(app, 'nearest');

		expect(directionsLink(sheet).getAttribute('href')).toContain('maps.apple.com');
		expect(directionsLink(sheet).getAttribute('aria-label')).toContain('in Apple Maps');

		const osmand = alternativeLink(sheet);
		expect(osmand?.textContent).toBe('Open in OsmAnd instead');
		expect(osmand?.getAttribute('href')).toBe(
			`https://osmand.net/map/navigate?end=${NEAREST_TAP_TO_USER.lat},${NEAREST_TAP_TO_USER.lon}&profile=pedestrian`
		);
		expect(osmand?.getAttribute('target')).toBe('_blank');
		expect(osmand?.getAttribute('rel')).toContain('noopener');
	});

	it('remembers OsmAnd once chosen and makes it the main directions button', async () => {
		const track = vi.fn();
		(window as TrackerWindow).umami = { track };
		const app = await renderApp(IPHONE);
		const sheet = await openSheetOf(app, 'nearest');

		const osmand = alternativeLink(sheet);
		if (osmand === null) {
			throw new Error('No OsmAnd link in the sheet');
		}
		clickWithoutNavigating(osmand);

		expect(track).toHaveBeenCalledWith('navigation_started', {
			facility_type: 'water',
			maps_app: 'osmand',
		});
		expect(localStorage.getItem(DIRECTIONS_APP_STORAGE_KEY)).toBe('osmand');

		await waitFor(() =>
			expect(directionsLink(sheet).getAttribute('href')).toContain('osmand.net/map/navigate')
		);
		expect(directionsLink(sheet).getAttribute('aria-label')).toContain('in OsmAnd');
		expect(alternativeLink(sheet)?.textContent).toBe('Open in Apple Maps instead');

		app.closeSheet();
		const another = await openSheetOf(app, 'another');
		expect(another.textContent).not.toContain(`ID: ${NEAREST_TAP_TO_USER.id}`);
		expect(directionsLink(another).getAttribute('href')).toContain('osmand.net/map/navigate');
	});

	it('keeps the OsmAnd preference across visits and lets the visitor switch back', async () => {
		const firstVisit = await renderApp(IPHONE);
		const sheet = await openSheetOf(firstVisit, 'nearest');
		const osmand = alternativeLink(sheet);
		if (osmand === null) {
			throw new Error('No OsmAnd link in the sheet');
		}
		clickWithoutNavigating(osmand);

		const secondVisit = await renderApp({ ...IPHONE, reload: true });
		const remembered = await openSheetOf(secondVisit, 'nearest');
		expect(directionsLink(remembered).getAttribute('href')).toContain('osmand.net');

		const appleMaps = alternativeLink(remembered);
		if (appleMaps === null) {
			throw new Error('No Apple Maps link in the sheet');
		}
		clickWithoutNavigating(appleMaps);
		expect(localStorage.getItem(DIRECTIONS_APP_STORAGE_KEY)).toBe('apple-maps');
		await waitFor(() =>
			expect(directionsLink(remembered).getAttribute('href')).toContain('maps.apple.com')
		);
	});
});

describe('Directions on platforms that need no in-app choice', () => {
	it('leaves an Android visitor with the system chooser only', async () => {
		const app = await renderApp({ ...IPHONE, device: 'android' });
		const sheet = await openSheetOf(app, 'nearest');

		expect(directionsLink(sheet).getAttribute('href')).toMatch(/^geo:/);
		expect(alternativeLink(sheet)).toBeNull();
	});

	it('sends a desktop visitor to Google Maps without offering OsmAnd', async () => {
		const track = vi.fn();
		(window as TrackerWindow).umami = { track };
		const app = await renderApp({ ...IPHONE, device: 'desktop' });
		const sheet = await openSheetOf(app, 'nearest');

		expect(directionsLink(sheet).getAttribute('href')).toContain('google.com/maps');
		expect(alternativeLink(sheet)).toBeNull();

		clickWithoutNavigating(directionsLink(sheet));
		expect(track).toHaveBeenCalledWith('navigation_started', {
			facility_type: 'water',
			maps_app: 'google-maps',
		});
	});
});
