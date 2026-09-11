import { describe, expect, it } from 'vitest';
import type { FacilityId } from '../../src/domain';
import { facilityId } from '../../src/domain';
import type { SheetState } from '../../src/ui/detail-sheet/sheet-state';
import { applySheet, initialSheetState, isSheetOpen } from '../../src/ui/detail-sheet/sheet-state';

const tap: FacilityId = facilityId({ type: 'node', id: 101 });
const toilet: FacilityId = facilityId({ type: 'way', id: 201 });

const openOn = (facility: FacilityId): SheetState =>
	applySheet(initialSheetState, { kind: 'shown', facilityId: facility, expansion: 'peek' });

describe('Opening and closing the sheet', () => {
	it('starts closed', () => {
		expect(initialSheetState).toEqual({ kind: 'closed' });
		expect(isSheetOpen(initialSheetState)).toBe(false);
	});

	it('opens in the requested state for a point', () => {
		expect(openOn(tap)).toEqual({ kind: 'open', facilityId: tap, expansion: 'peek' });
		expect(isSheetOpen(openOn(tap))).toBe(true);
	});

	it('closes when hidden', () => {
		expect(applySheet(openOn(tap), { kind: 'hidden' })).toEqual(initialSheetState);
	});

	it('keeps its expansion when the same point is shown again with fresh data', () => {
		const expanded = applySheet(openOn(tap), { kind: 'expanded' });

		const refreshed = applySheet(expanded, { kind: 'shown', facilityId: tap, expansion: 'peek' });

		expect(refreshed).toBe(expanded);
	});

	it('starts afresh in peek when another point is shown', () => {
		const expanded = applySheet(openOn(tap), { kind: 'expanded' });

		expect(applySheet(expanded, { kind: 'shown', facilityId: toilet, expansion: 'peek' })).toEqual({
			kind: 'open',
			facilityId: toilet,
			expansion: 'peek',
		});
	});
});

describe('Expanding and collapsing the sheet', () => {
	it('expands, collapses and toggles between peek and full', () => {
		const open = openOn(tap);

		expect(applySheet(open, { kind: 'expanded' }).kind === 'open').toBe(true);
		expect(applySheet(open, { kind: 'expanded' })).toEqual({ ...open, expansion: 'full' });
		expect(applySheet(applySheet(open, { kind: 'expanded' }), { kind: 'collapsed' })).toEqual(open);
		expect(applySheet(open, { kind: 'toggled' })).toEqual({ ...open, expansion: 'full' });
		expect(applySheet(applySheet(open, { kind: 'toggled' }), { kind: 'toggled' })).toEqual(open);
	});

	it('returns the same state when nothing changes', () => {
		const open = openOn(tap);

		expect(applySheet(open, { kind: 'collapsed' })).toBe(open);
		expect(applySheet(initialSheetState, { kind: 'expanded' })).toBe(initialSheetState);
		expect(applySheet(initialSheetState, { kind: 'toggled' })).toBe(initialSheetState);
	});
});
