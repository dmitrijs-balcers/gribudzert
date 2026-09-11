import { describe, expect, it } from 'vitest';
import { RERANK_MIN_MOVE_M } from '../../src/core/config';
import type { Facility, Located, UserPosition, WaterFacility } from '../../src/domain';
import {
	coordinates,
	distanceBetween,
	facilityFromTags,
	guidanceCourse,
	isWaterFacility,
	metersLiteral,
	timestampNow,
} from '../../src/domain';
import type { GuidanceAppEffect, GuidanceAppEvent, GuidanceAppState } from '../../src/app/guidance';
import {
	applyGuidanceApp,
	beelineOf,
	hudViewOf,
	initialGuidanceAppState,
	NEAREST_WATER_GLYPH,
	NEAREST_WATER_TITLE,
	sameView,
	selectedIdOf,
	sheetViewOf,
	targetOf,
} from '../../src/app/guidance';
import { presentationOf } from '../../src/features/presentation';
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

const positionAt = (point: { readonly lat: number; readonly lon: number }): UserPosition => {
	const place = coordinates(point.lat, point.lon);
	if (place === null) {
		throw new Error('fixture has invalid coordinates');
	}
	return {
		lat: place.lat,
		lon: place.lon,
		accuracy: metersLiteral(25),
		heading: null,
		speed: null,
		at: timestampNow(),
	};
};

const locate = (facility: Facility, isNearest = false): Located<Facility> => ({
	facility,
	distance: metersLiteral(420),
	isNearest,
});

const waterAt = (
	element: typeof NEAREST_TAP_TO_USER | typeof SEASONAL_TAP_NEAR_RIGA_CENTRE
): WaterFacility => {
	const facility = facilityAt(element, element, element.tags);
	if (!isWaterFacility(facility)) {
		throw new Error('fixture is not a water point');
	}
	return facility;
};

const nearestTap = waterAt(NEAREST_TAP_TO_USER);
const seasonalTap = waterAt(SEASONAL_TAP_NEAR_RIGA_CENTRE);
const toilet = facilityAt(ACCESSIBLE_TOILET, ACCESSIBLE_TOILET.center, ACCESSIBLE_TOILET.tags);

const here = positionAt(USER);
const aStepAway = positionAt({ lat: USER.lat + 0.00005, lon: USER.lon });
const farAway = positionAt({ lat: USER.lat + 0.005, lon: USER.lon });

const run = (
	events: readonly GuidanceAppEvent[],
	from: GuidanceAppState = initialGuidanceAppState
): { readonly state: GuidanceAppState; readonly effects: readonly GuidanceAppEffect[] } => {
	let state = from;
	const effects: GuidanceAppEffect[] = [];
	for (const event of events) {
		const [next, produced] = applyGuidanceApp(state, event);
		state = next;
		effects.push(...produced);
	}
	return { state, effects };
};

const guidedToNearestWater = run([
	{ kind: 'position-updated', position: here },
	{ kind: 'nearest-water-changed', nearest: locate(nearestTap, true) },
]).state;

describe('Tapping a marker', () => {
	it('opens the sheet on it, selects its marker and chooses it for guidance once', () => {
		const first = run([{ kind: 'facility-selected', item: locate(toilet) }], guidedToNearestWater);

		expect(first.effects).toEqual([{ kind: 'guidance-started', facilityKind: 'toilet' }]);
		expect(first.state.guidance).toEqual({ kind: 'chosen', facility: toilet });
		expect(selectedIdOf(first.state)).toBe(toilet.id);
		expect(sheetViewOf(first.state, 'web')).toMatchObject({
			kind: 'shown',
			detail: { id: toilet.id },
		});
		expect(hudViewOf(first.state)).toEqual({ kind: 'hidden' });

		const second = run([{ kind: 'facility-selected', item: locate(toilet) }], first.state);
		expect(second.effects).toEqual([]);
		expect(second.state.guidance).toEqual(first.state.guidance);
	});

	it('shows the live course to the guidance target on its sheet', () => {
		const { state } = run(
			[{ kind: 'facility-selected', item: locate(toilet) }],
			guidedToNearestWater
		);
		const course = guidanceCourse(here, { kind: 'chosen', facility: toilet });

		expect(sheetViewOf(state, 'web')).toMatchObject({
			kind: 'shown',
			detail: { live: { distance: course.distance, bearing: course.bearing } },
		});
	});
});

describe('Closing the sheet', () => {
	it('keeps the chosen guidance and brings the HUD back', () => {
		const { state } = run(
			[{ kind: 'facility-selected', item: locate(toilet) }, { kind: 'sheet-closed' }],
			guidedToNearestWater
		);

		expect(state.guidance).toEqual({ kind: 'chosen', facility: toilet });
		expect(selectedIdOf(state)).toBeNull();
		expect(sheetViewOf(state, 'web')).toEqual({ kind: 'hidden' });
		expect(hudViewOf(state)).toMatchObject({
			kind: 'shown',
			glyph: presentationOf(toilet).glyph,
			title: 'Guiding to Public Toilet',
			dismissible: true,
		});
		expect(beelineOf(state)).toEqual({
			from: { lat: here.lat, lon: here.lon },
			to: toilet.coordinates,
		});
	});
});

describe('Turning layers off', () => {
	it('hides nearest-water guidance and closes a water sheet when water goes off', () => {
		const opened = run(
			[{ kind: 'facility-selected', item: locate(nearestTap, true) }],
			guidedToNearestWater
		).state;
		const dismissed = run([{ kind: 'guidance-dismissed' }], opened).state;
		expect(targetOf(dismissed)).toEqual({ kind: 'nearest-water', facility: nearestTap });

		const { state } = run([{ kind: 'layer-toggled', layer: 'water', active: false }], dismissed);

		expect(state.nearestWater).toBeNull();
		expect(state.waterLayerActive).toBe(false);
		expect(targetOf(state)).toBeNull();
		expect(state.selection).toEqual({ kind: 'none' });
		expect(hudViewOf(state)).toEqual({ kind: 'hidden' });
		expect(beelineOf(state)).toBeNull();
	});

	it('keeps a fresh nearest report out of the target while water is off', () => {
		const { state } = run(
			[
				{ kind: 'layer-toggled', layer: 'water', active: false },
				{ kind: 'nearest-water-changed', nearest: locate(seasonalTap, true) },
			],
			guidedToNearestWater
		);

		expect(targetOf(state)).toBeNull();
		expect(targetOf({ ...state, waterLayerActive: true })).toEqual({
			kind: 'nearest-water',
			facility: seasonalTap,
		});
	});

	it('resets guidance when the chosen facility kind is disabled and leaves other kinds alone', () => {
		const chosen = run(
			[{ kind: 'facility-selected', item: locate(toilet) }],
			guidedToNearestWater
		).state;

		const viewpointsOff = run(
			[{ kind: 'layer-toggled', layer: 'viewpoint', active: false }],
			chosen
		).state;
		expect(viewpointsOff.guidance).toEqual({ kind: 'chosen', facility: toilet });
		expect(viewpointsOff.selection.kind).toBe('open');

		const toiletsOff = run(
			[{ kind: 'layer-toggled', layer: 'toilet', active: false }],
			chosen
		).state;
		expect(toiletsOff.guidance).toEqual({ kind: 'nearest' });
		expect(toiletsOff.selection).toEqual({ kind: 'none' });
		expect(hudViewOf(toiletsOff)).toMatchObject({
			kind: 'shown',
			title: NEAREST_WATER_TITLE,
		});
	});
});

describe('Reranking around the runner', () => {
	it('reranks on the first position and again only after moving far enough', () => {
		const first = run([{ kind: 'position-updated', position: here }]);
		expect(first.effects).toEqual([{ kind: 'origin-moved', position: here }]);

		const nudged = run([{ kind: 'position-updated', position: aStepAway }], first.state);
		expect(distanceBetween(here, aStepAway)).toBeLessThan(RERANK_MIN_MOVE_M);
		expect(nudged.effects).toEqual([]);

		const moved = run([{ kind: 'position-updated', position: farAway }], nudged.state);
		expect(moved.effects).toEqual([{ kind: 'origin-moved', position: farAway }]);
	});

	it('is suppressed while a sheet is open and resumes when it closes', () => {
		const opened = run([
			{ kind: 'position-updated', position: here },
			{ kind: 'facility-selected', item: locate(toilet) },
		]);

		const whileOpen = run([{ kind: 'position-updated', position: farAway }], opened.state);
		expect(whileOpen.effects).toEqual([]);
		expect(whileOpen.state.position).toEqual(farAway);

		const closed = run([{ kind: 'sheet-closed' }], whileOpen.state);
		expect(closed.effects).toEqual([{ kind: 'origin-moved', position: farAway }]);
		expect(closed.state.rankedFrom).toEqual(farAway);
	});

	it('does not rerank on close when the runner has not moved', () => {
		const { effects } = run([
			{ kind: 'position-updated', position: here },
			{ kind: 'facility-selected', item: locate(toilet) },
			{ kind: 'sheet-closed' },
		]);

		expect(effects).toEqual([
			{ kind: 'origin-moved', position: here },
			{ kind: 'guidance-started', facilityKind: 'toilet' },
		]);
	});
});

describe('The guidance HUD', () => {
	it('stays hidden until both a position and a target are known', () => {
		expect(hudViewOf(initialGuidanceAppState)).toEqual({ kind: 'hidden' });
		expect(hudViewOf(run([{ kind: 'position-updated', position: here }]).state)).toEqual({
			kind: 'hidden',
		});
		expect(
			hudViewOf(run([{ kind: 'nearest-water-changed', nearest: locate(nearestTap, true) }]).state)
		).toEqual({ kind: 'hidden' });
	});

	it('points at the nearest water without a way to dismiss it', () => {
		const course = guidanceCourse(here, { kind: 'nearest-water', facility: nearestTap });

		expect(hudViewOf(guidedToNearestWater)).toEqual({
			kind: 'shown',
			distance: course.distance,
			bearing: course.bearing,
			label: expect.stringMatching(/^[NESW]{1,2}$/),
			glyph: NEAREST_WATER_GLYPH,
			title: NEAREST_WATER_TITLE,
			dismissible: false,
		});
	});

	it('names a chosen point and can be dismissed back to the nearest water', () => {
		const chosen = run(
			[{ kind: 'facility-selected', item: locate(nearestTap, true) }, { kind: 'sheet-closed' }],
			guidedToNearestWater
		).state;

		expect(hudViewOf(chosen)).toMatchObject({
			kind: 'shown',
			glyph: presentationOf(nearestTap).glyph,
			title: 'Guiding to Drinking Water',
			dismissible: true,
		});

		const dismissed = run([{ kind: 'guidance-dismissed' }], chosen).state;
		expect(hudViewOf(dismissed)).toMatchObject({ title: NEAREST_WATER_TITLE, dismissible: false });
	});
});

describe('Revealing the target from the HUD', () => {
	it('opens the sheet on the target, flags it as nearest and flies to it', () => {
		const { state, effects } = run([{ kind: 'target-revealed' }], guidedToNearestWater);

		expect(effects).toEqual([{ kind: 'fly-to', coordinates: nearestTap.coordinates }]);
		expect(state.selection).toEqual({
			kind: 'open',
			item: {
				facility: nearestTap,
				distance: distanceBetween(here, nearestTap.coordinates),
				isNearest: true,
			},
		});
		expect(sheetViewOf(state, 'web')).toMatchObject({ detail: { nearest: true } });
	});

	it('does nothing without a position or a target', () => {
		const noPosition = run([
			{ kind: 'nearest-water-changed', nearest: locate(nearestTap, true) },
			{ kind: 'target-revealed' },
		]);
		expect(noPosition.effects).toEqual([]);
		expect(noPosition.state.selection).toEqual({ kind: 'none' });

		const noTarget = run([
			{ kind: 'position-updated', position: here },
			{ kind: 'target-revealed' },
		]);
		expect(noTarget.effects).toEqual([{ kind: 'origin-moved', position: here }]);
		expect(noTarget.state.selection).toEqual({ kind: 'none' });
	});
});

describe('Nearest water reports', () => {
	it('ignores a report that is not a water point and clears on an empty report', () => {
		const ignored = run(
			[{ kind: 'nearest-water-changed', nearest: locate(toilet, true) }],
			guidedToNearestWater
		);
		expect(ignored.state.nearestWater?.facility).toEqual(nearestTap);

		const cleared = run([{ kind: 'nearest-water-changed', nearest: null }], guidedToNearestWater);
		expect(cleared.state.nearestWater).toBeNull();
		expect(hudViewOf(cleared.state)).toEqual({ kind: 'hidden' });
	});
});

describe('Preferring a maps app for directions', () => {
	it('remembers the app, re-renders the sheet with it and asks to store it once', () => {
		const opened = run([{ kind: 'facility-selected', item: locate(toilet) }]);
		expect(sheetViewOf(opened.state, 'apple')).toMatchObject({
			detail: { directions: { app: 'apple-maps' }, alternativeDirections: { app: 'osmand' } },
		});

		const preferred = run([{ kind: 'directions-app-preferred', app: 'osmand' }], opened.state);
		expect(preferred.effects).toEqual([{ kind: 'directions-app-remembered', app: 'osmand' }]);
		expect(sheetViewOf(preferred.state, 'apple')).toMatchObject({
			detail: { directions: { app: 'osmand' }, alternativeDirections: { app: 'apple-maps' } },
		});

		const again = run([{ kind: 'directions-app-preferred', app: 'osmand' }], preferred.state);
		expect(again.effects).toEqual([]);
	});

	it('ignores a remembered app the platform does not offer', () => {
		const opened = run([{ kind: 'facility-selected', item: locate(toilet) }], {
			...initialGuidanceAppState,
			preferredDirectionsApp: 'osmand',
		});
		expect(sheetViewOf(opened.state, 'android')).toMatchObject({
			detail: { directions: { app: 'device-chooser' }, alternativeDirections: null },
		});
	});
});

describe('Comparing rendered views', () => {
	it('treats structurally equal views as the same and anything else as different', () => {
		expect(sameView(hudViewOf(guidedToNearestWater), hudViewOf(guidedToNearestWater))).toBe(true);
		expect(sameView(sheetViewOf(guidedToNearestWater, 'web'), { kind: 'hidden' })).toBe(true);
		expect(sameView({ kind: 'hidden' }, { kind: 'shown' })).toBe(false);
		expect(sameView([1, 2], [1, 2, 3])).toBe(false);
		expect(sameView({ a: 1 }, { a: 1, b: undefined })).toBe(false);
		expect(sameView(null, { kind: 'hidden' })).toBe(false);
	});
});
