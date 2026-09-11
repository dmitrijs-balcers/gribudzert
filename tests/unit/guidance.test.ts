import { describe, expect, it } from 'vitest';
import type { Facility, GuidanceState, ToiletFacility, WaterFacility } from '../../src/domain';
import {
	applyGuidance,
	coordinates,
	facilityFromTags,
	guidanceCourse,
	guidanceTargetOf,
	initialGuidanceState,
	isGuidedTo,
	isToiletFacility,
	isWaterFacility,
} from '../../src/domain';
import {
	ACCESSIBLE_TOILET,
	NEAREST_TAP_TO_USER,
	SEASONAL_TAP_NEAR_RIGA_CENTRE,
	USER,
} from '../fixtures';

const facilityAt = (
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

const waterAt = (
	element: typeof NEAREST_TAP_TO_USER | typeof SEASONAL_TAP_NEAR_RIGA_CENTRE
): WaterFacility => {
	const facility = facilityAt(element, element, element.tags);
	if (!isWaterFacility(facility)) {
		throw new Error('fixture is not a water point');
	}
	return facility;
};

const toiletAt = (element: typeof ACCESSIBLE_TOILET): ToiletFacility => {
	const facility = facilityAt(element, element.center, element.tags);
	if (!isToiletFacility(facility)) {
		throw new Error('fixture is not a toilet');
	}
	return facility;
};

const nearestTap = waterAt(NEAREST_TAP_TO_USER);
const seasonalTap = waterAt(SEASONAL_TAP_NEAR_RIGA_CENTRE);
const toilet = toiletAt(ACCESSIBLE_TOILET);

const guidedTo = (facility: Facility): GuidanceState =>
	applyGuidance(initialGuidanceState, { kind: 'facility-chosen', facility });

describe('Being guided to a chosen facility', () => {
	it('starts by following the nearest water point', () => {
		expect(initialGuidanceState).toEqual({ kind: 'nearest' });
	});

	it('follows the facility the visitor picked from its popup', () => {
		expect(guidedTo(toilet)).toEqual({ kind: 'chosen', facility: toilet });
	});

	it('switches to a newly picked facility, forgetting the earlier one', () => {
		const state = applyGuidance(guidedTo(toilet), {
			kind: 'facility-chosen',
			facility: seasonalTap,
		});

		expect(state).toEqual({ kind: 'chosen', facility: seasonalTap });
	});

	it('keeps guiding when the visitor picks the same facility again', () => {
		const state = applyGuidance(guidedTo(toilet), { kind: 'facility-chosen', facility: toilet });

		expect(state).toEqual({ kind: 'chosen', facility: toilet });
	});

	it('goes back to the nearest water point when the visitor dismisses the guidance', () => {
		const state = applyGuidance(guidedTo(toilet), { kind: 'guidance-dismissed' });

		expect(state).toEqual({ kind: 'nearest' });
		expect(guidanceTargetOf(state, nearestTap)).toEqual({
			kind: 'nearest-water',
			facility: nearestTap,
		});
	});

	it('stops guiding when the layer of the chosen facility is switched off', () => {
		expect(applyGuidance(guidedTo(toilet), { kind: 'layer-disabled', layer: 'toilet' })).toEqual({
			kind: 'nearest',
		});
		expect(
			applyGuidance(guidedTo(seasonalTap), { kind: 'layer-disabled', layer: 'water' })
		).toEqual({ kind: 'nearest' });
	});

	it('keeps guiding when a different layer is switched off', () => {
		const state = guidedTo(toilet);

		expect(applyGuidance(state, { kind: 'layer-disabled', layer: 'water' })).toBe(state);
	});

	it('is unaffected by a layer being switched off while following the nearest water point', () => {
		expect(applyGuidance(initialGuidanceState, { kind: 'layer-disabled', layer: 'water' })).toBe(
			initialGuidanceState
		);
	});
});

describe('Knowing what the compass points at', () => {
	it('points at the chosen facility even when a nearer water point exists', () => {
		expect(guidanceTargetOf(guidedTo(toilet), nearestTap)).toEqual({
			kind: 'chosen',
			facility: toilet,
		});
	});

	it('points at the nearest water point when nothing was chosen', () => {
		expect(guidanceTargetOf(initialGuidanceState, nearestTap)).toEqual({
			kind: 'nearest-water',
			facility: nearestTap,
		});
	});

	it('points at nothing when nothing was chosen and no water point is known', () => {
		expect(guidanceTargetOf(initialGuidanceState, null)).toBeNull();
	});
});

describe('Recognising the facility being guided to', () => {
	it('recognises the chosen facility', () => {
		expect(isGuidedTo(guidedTo(toilet), toilet)).toBe(true);
	});

	it('does not mistake another facility for the chosen one', () => {
		expect(isGuidedTo(guidedTo(toilet), nearestTap)).toBe(false);
	});

	it('recognises nothing while following the nearest water point', () => {
		expect(isGuidedTo(initialGuidanceState, nearestTap)).toBe(false);
	});
});

describe('Plotting the course to the target', () => {
	it('gives the distance and bearing from the visitor to the chosen facility', () => {
		const target = guidanceTargetOf(guidedTo(toilet), null);
		if (target === null) {
			throw new Error('expected a guidance target');
		}

		const course = guidanceCourse(USER, target);

		expect(course.distance).toBeGreaterThan(0);
		expect(course.bearing).toBeGreaterThanOrEqual(0);
		expect(course.bearing).toBeLessThan(360);
	});
});
