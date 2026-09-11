import { describe, expect, it } from 'vitest';
import type { Facility, GuidanceCourse, Located } from '../../src/domain';
import { coordinates, facilityFromTags, guidanceCourse, metersLiteral } from '../../src/domain';
import { detailViewOf, factsOf, NOT_DRINKABLE_WARNING } from '../../src/features/detail';
import { ACCESSIBLE_TOILET, NON_DRINKABLE, NOTABLE_VIEWPOINT, USER } from '../fixtures';

const facilityOf = (
	osm: { readonly type: 'node' | 'way'; readonly id: number },
	point: { readonly lat: number; readonly lon: number },
	tags: Readonly<Record<string, string>>
): Facility => {
	const position = coordinates(point.lat, point.lon);
	if (position === null) {
		throw new Error('fixture has invalid coordinates');
	}
	const facility = facilityFromTags(osm, position, tags);
	if (facility === null) {
		throw new Error('fixture tags do not describe a facility');
	}
	return facility;
};

const locate = (facility: Facility, isNearest = false): Located<Facility> => ({
	facility,
	distance: metersLiteral(420),
	isNearest,
});

const nonDrinkable = facilityOf(NON_DRINKABLE, NON_DRINKABLE, NON_DRINKABLE.tags);
const toilet = facilityOf(ACCESSIBLE_TOILET, ACCESSIBLE_TOILET.center, ACCESSIBLE_TOILET.tags);
const viewpoint = facilityOf(NOTABLE_VIEWPOINT, NOTABLE_VIEWPOINT, NOTABLE_VIEWPOINT.tags);

const courseTo = (facility: Facility): GuidanceCourse =>
	guidanceCourse(USER, { kind: 'chosen', facility });

describe('Describing a point for its sheet', () => {
	it('titles an unnamed point by its kind and identifies it by its OSM ref', () => {
		const view = detailViewOf(locate(nonDrinkable), null, 'web');

		expect(view.kindLabel).toBe('Drinking Water');
		expect(view.title).toBe('Drinking Water');
		expect(view.identity).toBe(`node ${NON_DRINKABLE.id}`);
		expect(view.osmId).toBe(NON_DRINKABLE.id);
		expect(view.osmUrl).toBe(`https://www.openstreetmap.org/node/${NON_DRINKABLE.id}`);
	});

	it('titles a named point by its name and offers walking directions to it', () => {
		const view = detailViewOf(locate(viewpoint), null, 'web');

		expect(view.title).toBe('Cathedral Hill');
		expect(view.directionsLabel).toBe('Get walking directions to Cathedral Hill');
		expect(view.directionsUrl).toContain(`${NOTABLE_VIEWPOINT.lat},${NOTABLE_VIEWPOINT.lon}`);
		expect(view.directionsUrl).toContain('travelmode=walking');
	});

	it('shows distance and compass point from a guidance course', () => {
		const course = courseTo(nonDrinkable);
		const view = detailViewOf(locate(nonDrinkable), course, 'web');

		expect(view.live).toEqual({
			distance: course.distance,
			bearing: course.bearing,
			compassPoint: expect.stringMatching(/^[NESW]{1,2}$/),
		});
	});

	it('falls back to the ranked distance without a compass point when no position is known', () => {
		const view = detailViewOf(locate(nonDrinkable), null, 'web');

		expect(view.live).toEqual({ distance: 420, bearing: null, compassPoint: null });
	});

	it('warns about water that is not drinkable', () => {
		expect(detailViewOf(locate(nonDrinkable), null, 'web').warnings).toEqual([
			NOT_DRINKABLE_WARNING,
		]);
		expect(detailViewOf(locate(toilet), null, 'web').warnings).toEqual([]);
	});

	it('flags the nearest water point', () => {
		expect(detailViewOf(locate(nonDrinkable, true), null, 'web').nearest).toBe(true);
		expect(detailViewOf(locate(nonDrinkable), null, 'web').nearest).toBe(false);
	});

	it('carries the photo and links of a notable viewpoint', () => {
		const view = detailViewOf(locate(viewpoint), null, 'web');

		expect(view.photo?.pageUrl).toBe('https://commons.wikimedia.org/wiki/File:Cathedral_Hill.jpg');
		expect(view.links.map((link) => link.kind)).toEqual(['wikipedia', 'website']);
		expect(view.description).toBe('Panoramic view over the old town');
	});
});

describe('Listing the facts of a point', () => {
	it('never lists an unknown value', () => {
		const bareToilet = facilityOf(ACCESSIBLE_TOILET, ACCESSIBLE_TOILET.center, {
			amenity: 'toilets',
		});

		expect(factsOf(bareToilet)).toEqual([]);
		expect(
			factsOf(facilityOf(NON_DRINKABLE, NON_DRINKABLE, { amenity: 'drinking_water' }))
		).toEqual([]);
	});

	it('lists what is known about a toilet', () => {
		const wellDescribed = facilityOf(ACCESSIBLE_TOILET, ACCESSIBLE_TOILET.center, {
			amenity: 'toilets',
			wheelchair: 'yes',
			changing_table: 'no',
			fee: 'no',
			unisex: 'yes',
			opening_hours: '24/7',
			operator: 'City of Riga',
			note: 'Ring the bell',
		});

		expect(factsOf(wellDescribed).map((fact) => [fact.icon, fact.label, fact.value])).toEqual([
			['wheelchair', 'Wheelchair Accessible', null],
			['changing-table', 'No changing table', null],
			['fee', 'Free', null],
			['unisex', 'Gender-neutral', null],
			['hours', 'Hours', '24/7'],
			['operator', 'Operator', 'City of Riga'],
			['note', 'Note', 'Ring the bell'],
		]);
	});

	it('lists what is known about a water point', () => {
		const seasonal = facilityOf(NON_DRINKABLE, NON_DRINKABLE, {
			man_made: 'water_tap',
			seasonal: 'yes',
			bottle: 'yes',
			wheelchair: 'limited',
		});

		expect(factsOf(seasonal).map((fact) => fact.label)).toEqual([
			'Limited wheelchair access',
			'Seasonal',
			'Bottle refill',
		]);
	});

	it('lists the elevation of a viewpoint', () => {
		expect(factsOf(viewpoint)).toEqual([{ icon: 'elevation', label: 'Elevation', value: '42 m' }]);
	});
});
