import type { DetailView } from '../../features/detail';

export type SheetExpansion = 'peek' | 'full';

export type SheetPhoto = 'shown' | 'failed';

export type OpenSheet = {
	readonly kind: 'open';
	readonly detail: DetailView;
	readonly expansion: SheetExpansion;
	readonly photo: SheetPhoto;
};

export type SheetState = { readonly kind: 'closed' } | OpenSheet;

export type SheetEvent =
	| { readonly kind: 'shown'; readonly detail: DetailView }
	| { readonly kind: 'hidden' }
	| { readonly kind: 'collapsed' }
	| { readonly kind: 'toggled' }
	| { readonly kind: 'photo-failed' };

export type SheetTransition = {
	readonly opened: boolean;
	readonly closed: boolean;
	readonly facilityChanged: boolean;
};

export const initialSheetState: SheetState = { kind: 'closed' };

const toggled = (expansion: SheetExpansion): SheetExpansion =>
	expansion === 'peek' ? 'full' : 'peek';

const shown = (state: SheetState, detail: DetailView): SheetState =>
	state.kind === 'open' && state.detail.id === detail.id
		? { ...state, detail }
		: { kind: 'open', detail, expansion: 'peek', photo: 'shown' };

const withExpansion = (state: SheetState, expansion: SheetExpansion): SheetState =>
	state.kind === 'open' && state.expansion !== expansion ? { ...state, expansion } : state;

const withFailedPhoto = (state: SheetState): SheetState =>
	state.kind === 'open' && state.photo !== 'failed' ? { ...state, photo: 'failed' } : state;

export const applySheet = (state: SheetState, event: SheetEvent): SheetState => {
	switch (event.kind) {
		case 'shown':
			return shown(state, event.detail);
		case 'hidden':
			return initialSheetState;
		case 'collapsed':
			return withExpansion(state, 'peek');
		case 'toggled':
			return state.kind === 'open' ? withExpansion(state, toggled(state.expansion)) : state;
		case 'photo-failed':
			return withFailedPhoto(state);
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
};

export const isSheetOpen = (state: SheetState): boolean => state.kind === 'open';

export const photoShown = (state: SheetState): boolean =>
	state.kind === 'open' && state.detail.photo !== null && state.photo !== 'failed';

export const sheetTransition = (previous: SheetState, next: SheetState): SheetTransition => ({
	opened: previous.kind === 'closed' && next.kind === 'open',
	closed: previous.kind === 'open' && next.kind === 'closed',
	facilityChanged:
		next.kind === 'open' && (previous.kind === 'closed' || previous.detail.id !== next.detail.id),
});
