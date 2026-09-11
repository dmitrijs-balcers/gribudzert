import type { FacilityId } from '../../domain';

export type SheetExpansion = 'peek' | 'full';

export type SheetState =
	| { readonly kind: 'closed' }
	| { readonly kind: 'open'; readonly facilityId: FacilityId; readonly expansion: SheetExpansion };

export type SheetEvent =
	| { readonly kind: 'shown'; readonly facilityId: FacilityId; readonly expansion: SheetExpansion }
	| { readonly kind: 'hidden' }
	| { readonly kind: 'expanded' }
	| { readonly kind: 'collapsed' }
	| { readonly kind: 'toggled' };

export const initialSheetState: SheetState = { kind: 'closed' };

const toggled = (expansion: SheetExpansion): SheetExpansion =>
	expansion === 'peek' ? 'full' : 'peek';

const shown = (
	state: SheetState,
	facilityId: FacilityId,
	expansion: SheetExpansion
): SheetState => {
	if (state.kind === 'open' && state.facilityId === facilityId) {
		return state;
	}
	return { kind: 'open', facilityId, expansion };
};

const withExpansion = (state: SheetState, expansion: SheetExpansion): SheetState =>
	state.kind === 'open' && state.expansion !== expansion ? { ...state, expansion } : state;

export const applySheet = (state: SheetState, event: SheetEvent): SheetState => {
	switch (event.kind) {
		case 'shown':
			return shown(state, event.facilityId, event.expansion);
		case 'hidden':
			return initialSheetState;
		case 'expanded':
			return withExpansion(state, 'full');
		case 'collapsed':
			return withExpansion(state, 'peek');
		case 'toggled':
			return state.kind === 'open' ? withExpansion(state, toggled(state.expansion)) : state;
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
};

export const isSheetOpen = (state: SheetState): boolean => state.kind === 'open';
