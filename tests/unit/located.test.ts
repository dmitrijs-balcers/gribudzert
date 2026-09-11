import { describe, expect, it } from 'vitest';
import type { Located, Meters } from '../../src/domain';
import {
	coordinates,
	facilityFromTags,
	sameLocated,
	sameLocatedList,
	withDistances,
} from '../../src/domain';
import { NEAREST_TAP_TO_USER, NON_DRINKABLE, USER } from '../fixtures';

const locate = (
	element: typeof NEAREST_TAP_TO_USER | typeof NON_DRINKABLE,
	isNearest = false
): Located => {
	const position = coordinates(element.lat, element.lon);
	if (position === null) {
		throw new Error('fixture has invalid coordinates');
	}
	const facility = facilityFromTags({ type: element.type, id: element.id }, position, element.tags);
	if (facility === null) {
		throw new Error(`Fixture ${element.id} is not a facility`);
	}
	const [located] = withDistances([facility], USER);
	if (located === undefined) {
		throw new Error('withDistances dropped the facility');
	}
	return { ...located, isNearest };
};

describe('sameLocated', () => {
	it('treats the same point at the same distance as unchanged', () => {
		expect(sameLocated(locate(NEAREST_TAP_TO_USER), locate(NEAREST_TAP_TO_USER))).toBe(true);
	});

	it('sees a different point as a change', () => {
		expect(sameLocated(locate(NEAREST_TAP_TO_USER), locate(NON_DRINKABLE))).toBe(false);
	});

	it('sees a moved distance or a new nearest flag as a change', () => {
		const item = locate(NEAREST_TAP_TO_USER);
		expect(sameLocated(item, { ...item, distance: (item.distance + 1) as Meters })).toBe(false);
		expect(sameLocated(item, { ...item, isNearest: true })).toBe(false);
	});
});

describe('sameLocatedList', () => {
	it('matches lists with the same points in the same order', () => {
		const list = [locate(NEAREST_TAP_TO_USER, true), locate(NON_DRINKABLE)];
		expect(sameLocatedList(list, [locate(NEAREST_TAP_TO_USER, true), locate(NON_DRINKABLE)])).toBe(
			true
		);
	});

	it('sees a different length or order as a change', () => {
		const list = [locate(NEAREST_TAP_TO_USER, true), locate(NON_DRINKABLE)];
		expect(sameLocatedList(list, [locate(NEAREST_TAP_TO_USER, true)])).toBe(false);
		expect(sameLocatedList(list, [locate(NON_DRINKABLE), locate(NEAREST_TAP_TO_USER, true)])).toBe(
			false
		);
		expect(sameLocatedList([], [])).toBe(true);
	});
});
