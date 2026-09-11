import { describe, expect, it } from 'vitest';
import type { Facility, Located, Meters } from '../../src/domain';
import {
	chooseDirectionsApp,
	coordinates,
	facilityFromTags,
	metersLiteral,
} from '../../src/domain';
import type { DetailView } from '../../src/features/detail';
import { detailViewOf } from '../../src/features/detail';
import type { SheetState } from '../../src/ui/detail-sheet';
import {
	applySheet,
	initialSheetState,
	isSheetOpen,
	photoShown,
	sheetTransition,
} from '../../src/ui/detail-sheet';
import { ACCESSIBLE_TOILET, NON_DRINKABLE, NOTABLE_VIEWPOINT } from '../fixtures';

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

const detailOf = (facility: Facility, distance: Meters): DetailView => {
	const located: Located<Facility> = { facility, distance, isNearest: false };
	return detailViewOf(located, null, chooseDirectionsApp('web', null));
};

const tap = detailOf(
	facilityOf(NON_DRINKABLE, NON_DRINKABLE, NON_DRINKABLE.tags),
	metersLiteral(420)
);
const tapCloser = detailOf(
	facilityOf(NON_DRINKABLE, NON_DRINKABLE, NON_DRINKABLE.tags),
	metersLiteral(80)
);
const toilet = detailOf(
	facilityOf(ACCESSIBLE_TOILET, ACCESSIBLE_TOILET.center, ACCESSIBLE_TOILET.tags),
	metersLiteral(300)
);
const viewpoint = detailOf(
	facilityOf(NOTABLE_VIEWPOINT, NOTABLE_VIEWPOINT, NOTABLE_VIEWPOINT.tags),
	metersLiteral(900)
);

const openOn = (detail: DetailView): SheetState =>
	applySheet(initialSheetState, { kind: 'shown', detail });

const expand = (state: SheetState): SheetState => applySheet(state, { kind: 'toggled' });

describe('Opening and closing the sheet', () => {
	it('starts closed', () => {
		expect(initialSheetState).toEqual({ kind: 'closed' });
		expect(isSheetOpen(initialSheetState)).toBe(false);
	});

	it('opens a point in peek with its photo shown', () => {
		expect(openOn(tap)).toEqual({ kind: 'open', detail: tap, expansion: 'peek', photo: 'shown' });
		expect(isSheetOpen(openOn(tap))).toBe(true);
	});

	it('closes when hidden', () => {
		expect(applySheet(openOn(tap), { kind: 'hidden' })).toEqual(initialSheetState);
	});

	it('keeps expansion and photo status but takes fresh data when the same point is shown again', () => {
		const expanded = applySheet(expand(openOn(viewpoint)), { kind: 'photo-failed' });
		const refreshedViewpoint = detailOf(
			facilityOf(NOTABLE_VIEWPOINT, NOTABLE_VIEWPOINT, NOTABLE_VIEWPOINT.tags),
			metersLiteral(120)
		);

		const refreshed = applySheet(expanded, { kind: 'shown', detail: refreshedViewpoint });

		expect(refreshed).toEqual({
			kind: 'open',
			detail: refreshedViewpoint,
			expansion: 'full',
			photo: 'failed',
		});
	});

	it('starts afresh in peek when another point is shown', () => {
		const expanded = applySheet(expand(openOn(viewpoint)), { kind: 'photo-failed' });

		expect(applySheet(expanded, { kind: 'shown', detail: toilet })).toEqual({
			kind: 'open',
			detail: toilet,
			expansion: 'peek',
			photo: 'shown',
		});
	});
});

describe('Expanding and collapsing the sheet', () => {
	it('toggles between peek and full and collapses back to peek', () => {
		const open = openOn(tap);

		expect(expand(open)).toEqual({ ...open, expansion: 'full' });
		expect(expand(expand(open))).toEqual(open);
		expect(applySheet(expand(open), { kind: 'collapsed' })).toEqual(open);
	});

	it('returns the same state when nothing changes', () => {
		const open = openOn(tap);

		expect(applySheet(open, { kind: 'collapsed' })).toBe(open);
		expect(applySheet(initialSheetState, { kind: 'collapsed' })).toBe(initialSheetState);
		expect(applySheet(initialSheetState, { kind: 'toggled' })).toBe(initialSheetState);
		expect(applySheet(initialSheetState, { kind: 'photo-failed' })).toBe(initialSheetState);
	});
});

describe('Showing the photo', () => {
	it('shows a photo only for an open point that has one and whose image loaded', () => {
		expect(photoShown(initialSheetState)).toBe(false);
		expect(photoShown(openOn(tap))).toBe(false);
		expect(photoShown(openOn(viewpoint))).toBe(true);
	});

	it('hides the photo once its image fails and remembers the failure', () => {
		const failed = applySheet(openOn(viewpoint), { kind: 'photo-failed' });

		expect(photoShown(failed)).toBe(false);
		expect(applySheet(failed, { kind: 'photo-failed' })).toBe(failed);
	});
});

describe('Describing what changed between two sheet states', () => {
	it('reports opening as a facility change', () => {
		expect(sheetTransition(initialSheetState, openOn(tap))).toEqual({
			opened: true,
			closed: false,
			facilityChanged: true,
		});
	});

	it('reports closing without a facility change', () => {
		expect(sheetTransition(openOn(tap), initialSheetState)).toEqual({
			opened: false,
			closed: true,
			facilityChanged: false,
		});
	});

	it('reports switching points while open', () => {
		expect(sheetTransition(openOn(tap), openOn(toilet))).toEqual({
			opened: false,
			closed: false,
			facilityChanged: true,
		});
	});

	it('reports nothing for a live refresh of the same point', () => {
		const refreshed = applySheet(openOn(tap), { kind: 'shown', detail: tapCloser });

		expect(sheetTransition(openOn(tap), refreshed)).toEqual({
			opened: false,
			closed: false,
			facilityChanged: false,
		});
		expect(sheetTransition(initialSheetState, initialSheetState)).toEqual({
			opened: false,
			closed: false,
			facilityChanged: false,
		});
	});
});
