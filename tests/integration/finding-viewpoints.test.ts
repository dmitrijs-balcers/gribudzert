import { waitFor } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import type { Coordinates } from '../../src/domain';
import {
	coordinates,
	facilityFromTags,
	parseFacility,
	viewpointProminenceOf,
} from '../../src/domain';
import {
	BARE_VIEWPOINT,
	isViewpointQuery,
	NAMED_VIEWPOINT,
	NOTABLE_VIEWPOINT,
	VIEWPOINT_ELEMENTS,
	WATER_ELEMENTS,
	WATER_MARKER_COUNT,
} from '../fixtures';
import { renderApp } from '../harness';

describe('Finding viewpoints', () => {
	it('starts with the viewpoint layer off', async () => {
		const app = await renderApp();

		expect(app.isLayerOn('Viewpoints')).toBe(false);
		expect(app.overpass.requests.map((request) => isViewpointQuery(request.query))).toEqual([
			false,
		]);
	});

	it('loads viewpoints when the layer is ticked, sizing badges by prominence', async () => {
		const app = await renderApp({
			overpass: (request) =>
				isViewpointQuery(request.query) ? VIEWPOINT_ELEMENTS : WATER_ELEMENTS,
		});
		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));

		app.toggleLayer('Viewpoints');

		await waitFor(() => expect(app.overpass.requests).toHaveLength(2));
		expect(app.overpass.lastRequest().query).toContain('tourism"="viewpoint');
		await waitFor(() =>
			expect(app.markers()).toHaveLength(WATER_MARKER_COUNT + VIEWPOINT_ELEMENTS.length)
		);

		const allMarkers = app.markers();
		const viewpointMarkers = allMarkers.filter(
			(marker) => marker.getAttribute('data-facility-kind') === 'viewpoint'
		);
		expect(viewpointMarkers).toHaveLength(3);

		const badgeWidthOf = (marker: Element): string | undefined =>
			marker.querySelector<HTMLElement>('.facility-marker-badge')?.style.width;

		const bareMarker = viewpointMarkers.find((marker) => badgeWidthOf(marker) === '18px');
		const namedMarker = viewpointMarkers.find((marker) => badgeWidthOf(marker) === '30px');
		const notableMarker = viewpointMarkers.find((marker) => badgeWidthOf(marker) === '40px');

		expect(bareMarker).toBeDefined();
		expect(namedMarker).toBeDefined();
		expect(notableMarker).toBeDefined();

		expect(bareMarker?.classList.contains('facility-marker--viewpoint')).toBe(true);
		expect(bareMarker?.querySelector('.facility-marker-svg')).toBeNull();
		expect(namedMarker?.querySelector('.facility-marker-svg')).not.toBeNull();
		expect(notableMarker?.classList.contains('notable-marker')).toBe(true);
		expect(bareMarker?.classList.contains('notable-marker')).toBe(false);
		expect(namedMarker?.classList.contains('notable-marker')).toBe(false);

		if (notableMarker !== undefined) {
			app.openPopupOf(allMarkers.indexOf(notableMarker));
			await waitFor(() => expect(app.popupText()).toContain('Cathedral Hill'));
			expect(app.popupText()).toContain('Elevation: 42 m');
		}

		app.toggleLayer('Viewpoints');

		await waitFor(() => expect(app.markers()).toHaveLength(WATER_MARKER_COUNT));
	});
});

describe('viewpointProminenceOf', () => {
	it('is bare with no distinguishing tags', () => {
		expect(viewpointProminenceOf(BARE_VIEWPOINT.tags)).toBe('bare');
	});

	it('is named with a name but no media tags', () => {
		expect(viewpointProminenceOf(NAMED_VIEWPOINT.tags)).toBe('named');
	});

	it('is named with only a description', () => {
		expect(viewpointProminenceOf({ tourism: 'viewpoint', description: 'Nice spot' })).toBe('named');
	});

	it('is notable with a wikipedia tag even without a name', () => {
		expect(viewpointProminenceOf({ tourism: 'viewpoint', wikipedia: 'en:Foo' })).toBe('notable');
	});

	it('is notable with an image, wikimedia_commons or wikidata tag', () => {
		expect(viewpointProminenceOf({ tourism: 'viewpoint', image: 'foo.jpg' })).toBe('notable');
		expect(viewpointProminenceOf({ tourism: 'viewpoint', wikimedia_commons: 'Category:Foo' })).toBe(
			'notable'
		);
		expect(viewpointProminenceOf({ tourism: 'viewpoint', wikidata: 'Q1' })).toBe('notable');
	});
});

const requireCoordinates = (lat: number, lon: number): Coordinates => {
	const value = coordinates(lat, lon);
	if (value === null) {
		throw new Error(`Invalid coordinates: ${lat}, ${lon}`);
	}
	return value;
};

describe('viewpoint facility round-trip', () => {
	it('survives a JSON parse of a cached viewpoint facility', () => {
		const facility = facilityFromTags(
			{ type: 'node', id: 303 },
			requireCoordinates(56.954, 24.109),
			NOTABLE_VIEWPOINT.tags
		);
		expect(facility?.kind).toBe('viewpoint');

		const roundTripped = parseFacility(JSON.parse(JSON.stringify(facility)));
		expect(roundTripped).toEqual(facility);
	});

	it('rejects a viewpoint with an invalid prominence value', () => {
		const facility = facilityFromTags(
			{ type: 'node', id: 301 },
			requireCoordinates(56.953, 24.108),
			BARE_VIEWPOINT.tags
		);
		const tampered = { ...facility, prominence: 'legendary' };
		expect(parseFacility(tampered)).toBeNull();
	});
});
