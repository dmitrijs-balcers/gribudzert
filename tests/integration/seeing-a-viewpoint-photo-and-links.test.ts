import { waitFor, within } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import {
	isViewpointQuery,
	NOTABLE_VIEWPOINT,
	VIEWPOINT_ELEMENTS,
	WATER_ELEMENTS,
	WATER_MARKER_COUNT,
} from '../fixtures';
import type { AppHandle } from '../harness';
import { renderApp } from '../harness';

const COMMONS_THUMBNAIL =
	'https://commons.wikimedia.org/wiki/Special:FilePath/Cathedral_Hill.jpg?width=640';
const COMMONS_PAGE = 'https://commons.wikimedia.org/wiki/File:Cathedral_Hill.jpg';
const WIKIPEDIA_ARTICLE = 'https://lv.wikipedia.org/wiki/Katedr%C4%81les_kalns';
const WEBSITE = 'https://www.example.org/hill';

const openTheNotableViewpoint = async (app: AppHandle): Promise<void> => {
	await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
	app.toggleLayer('Viewpoints');
	await waitFor(() =>
		expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + VIEWPOINT_ELEMENTS.length)
	);
	const notableIndex = app
		.markers()
		.findIndex((marker) => marker.classList.contains('notable-marker'));
	app.tapMarker(notableIndex);
	await waitFor(() => expect(app.sheetText()).toContain(NOTABLE_VIEWPOINT.tags.name));
};

describe('Seeing a viewpoint photo and links', () => {
	it('shows a Commons thumbnail in the peek card', async () => {
		const app = await renderApp({
			overpass: (request) =>
				isViewpointQuery(request.query) ? VIEWPOINT_ELEMENTS : WATER_ELEMENTS,
		});
		await openTheNotableViewpoint(app);

		const sheet = app.sheet() as HTMLElement;
		const thumb = sheet.querySelector<HTMLImageElement>('.detail-sheet-thumb img');
		expect(thumb).not.toBeNull();
		expect(thumb?.closest('a')?.hidden).toBe(false);
		expect(thumb?.getAttribute('src')).toBe(COMMONS_THUMBNAIL);
		expect(thumb?.getAttribute('loading')).toBe('lazy');
		expect(thumb?.closest('a')?.getAttribute('href')).toBe(COMMONS_PAGE);
		expect(sheet.querySelector<HTMLElement>('.detail-sheet-hero')?.hidden).toBe(true);
	});

	it('shows the hero photo with a Commons credit and link chips once expanded', async () => {
		const app = await renderApp({
			overpass: (request) =>
				isViewpointQuery(request.query) ? VIEWPOINT_ELEMENTS : WATER_ELEMENTS,
		});
		await openTheNotableViewpoint(app);

		app.expandSheet();

		const sheet = app.sheet() as HTMLElement;
		expect(sheet.getAttribute('data-state')).toBe('full');
		expect(sheet.querySelector<HTMLElement>('.detail-sheet-hero')?.hidden).toBe(false);
		const hero = sheet.querySelector<HTMLImageElement>('.detail-sheet-hero img');
		expect(hero?.getAttribute('src')).toBe(COMMONS_THUMBNAIL);
		expect(hero?.getAttribute('decoding')).toBe('async');
		expect(hero?.closest('a')?.getAttribute('href')).toBe(COMMONS_PAGE);

		const credit = within(sheet).getByRole('link', { name: 'Wikimedia Commons' });
		expect(credit.getAttribute('href')).toBe(COMMONS_PAGE);

		const wikipedia = within(sheet).getByRole('link', { name: 'Wikipedia' });
		expect(wikipedia.getAttribute('href')).toBe(WIKIPEDIA_ARTICLE);
		expect(wikipedia.getAttribute('target')).toBe('_blank');
		expect(wikipedia.getAttribute('rel')).toBe('noopener noreferrer');

		const website = within(sheet).getByRole('link', { name: 'example.org' });
		expect(website.getAttribute('href')).toBe(WEBSITE);
		expect(website.getAttribute('rel')).toBe('noopener noreferrer');

		expect(sheet.querySelector('.detail-sheet-details')?.getAttribute('aria-expanded')).toBe(
			'true'
		);
	});

	it('drops the photo and keeps the card usable when the image fails to load', async () => {
		const app = await renderApp({
			overpass: (request) =>
				isViewpointQuery(request.query) ? VIEWPOINT_ELEMENTS : WATER_ELEMENTS,
		});
		await openTheNotableViewpoint(app);
		const sheet = app.sheet() as HTMLElement;
		const thumb = sheet.querySelector<HTMLImageElement>('.detail-sheet-thumb img') as HTMLElement;

		thumb.dispatchEvent(new Event('error'));

		expect(sheet.querySelector<HTMLElement>('.detail-sheet-thumb')?.hidden).toBe(true);
		app.expandSheet();
		expect(sheet.querySelector<HTMLElement>('.detail-sheet-hero')?.hidden).toBe(true);
		expect(app.sheetText()).toContain('Elevation: 42 m');
	});
});
