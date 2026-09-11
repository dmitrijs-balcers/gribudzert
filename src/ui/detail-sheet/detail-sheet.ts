import * as L from 'leaflet';
import type { Coordinates } from '../../domain';
import type { DetailView } from '../../features/detail';
import { createElements } from './elements';
import { createHistoryEntry } from './history';
import { SHEET_HEIGHT_PROPERTY } from './labels';
import { renderDirections, renderExpansion, renderLive, renderStatic } from './render';
import type { SheetEvent, SheetState } from './sheet-state';
import { applySheet, initialSheetState, photoShown, sheetTransition } from './sheet-state';
import './detail-sheet.css';

export type DetailSheetView =
	| { readonly kind: 'hidden' }
	| { readonly kind: 'shown'; readonly detail: DetailView };

export type DetailSheetHandlers = {
	readonly onClose: () => void;
	readonly onDirections: (detail: DetailView) => void;
	readonly onAlternativeDirections: (detail: DetailView) => void;
};

export type DetailSheet = {
	readonly render: (view: DetailSheetView) => void;
	readonly destroy: () => void;
};

const REVEAL_GAP_PX = 24;
const HISTORY_STATE_KEY = 'detailSheet';

const isEscape = (event: KeyboardEvent): boolean => event.key === 'Escape';

const sheetEventOf = (view: DetailSheetView): SheetEvent => {
	switch (view.kind) {
		case 'hidden':
			return { kind: 'hidden' };
		case 'shown':
			return { kind: 'shown', detail: view.detail };
		default: {
			const exhaustive: never = view;
			throw new Error(`Unhandled detail sheet view: ${JSON.stringify(exhaustive)}`);
		}
	}
};

export function createDetailSheet(map: L.Map, handlers: DetailSheetHandlers): DetailSheet {
	const elements = createElements();
	map.getContainer().appendChild(elements.root);
	L.DomEvent.disableClickPropagation(elements.root);
	L.DomEvent.disableScrollPropagation(elements.root);

	const historyEntry = createHistoryEntry(HISTORY_STATE_KEY);
	let state: SheetState = initialSheetState;
	let previouslyFocused: Element | null = null;

	const measuredHeight = (): number =>
		elements.root.hidden ? 0 : Math.round(elements.root.getBoundingClientRect().height);

	const publishHeight = (): void => {
		document.documentElement.style.setProperty(SHEET_HEIGHT_PROPERTY, `${measuredHeight()}px`);
	};

	const reveal = (coordinates: Coordinates): void => {
		const size = map.getSize();
		if (size.x === 0 || size.y === 0) {
			return;
		}
		map.panInside([coordinates.lat, coordinates.lon], {
			paddingBottomRight: [0, measuredHeight() + REVEAL_GAP_PX],
			paddingTopLeft: [0, REVEAL_GAP_PX],
		});
	};

	const restoreFocus = (): void => {
		const target = previouslyFocused;
		previouslyFocused = null;
		if (target instanceof HTMLElement && document.contains(target)) {
			target.focus();
		}
	};

	const onKeyDown = (event: KeyboardEvent): void => {
		if (isEscape(event)) {
			event.preventDefault();
			closeByUser();
		}
	};

	const open = (): void => {
		previouslyFocused = document.activeElement;
		elements.root.hidden = false;
		document.addEventListener('keydown', onKeyDown, true);
		historyEntry.push();
		elements.title.focus();
	};

	const close = (): void => {
		elements.root.hidden = true;
		document.removeEventListener('keydown', onKeyDown, true);
		publishHeight();
		restoreFocus();
		historyEntry.pop();
	};

	const dispatch = (event: SheetEvent): void => {
		const previous = state;
		state = applySheet(previous, event);
		const transition = sheetTransition(previous, state);
		if (transition.opened) {
			open();
		}
		if (state.kind === 'open') {
			if (transition.facilityChanged) {
				renderStatic(elements, state.detail);
			} else {
				renderDirections(elements, state.detail);
			}
			renderLive(elements, state.detail.live);
			renderExpansion(elements, state.expansion, photoShown(state));
			publishHeight();
			if (transition.facilityChanged) {
				reveal(state.detail.coordinates);
			}
		}
		if (transition.closed) {
			close();
		}
	};

	const closeByUser = (): void => {
		if (state.kind === 'closed') {
			return;
		}
		dispatch({ kind: 'hidden' });
		handlers.onClose();
	};

	const onPhotoError = (): void => dispatch({ kind: 'photo-failed' });

	elements.hero.image.addEventListener('error', onPhotoError);
	elements.thumb.image.addEventListener('error', onPhotoError);
	elements.close.addEventListener('click', closeByUser);
	elements.collapse.addEventListener('click', () => dispatch({ kind: 'collapsed' }));
	elements.details.addEventListener('click', () => dispatch({ kind: 'toggled' }));
	elements.directions.addEventListener('click', () => {
		if (state.kind === 'open') {
			handlers.onDirections(state.detail);
		}
	});
	elements.alternativeDirections.addEventListener('click', () => {
		if (state.kind === 'open') {
			handlers.onAlternativeDirections(state.detail);
		}
	});
	historyEntry.onPopped(closeByUser);
	map.on('click', closeByUser);

	const observer =
		typeof ResizeObserver === 'function' ? new ResizeObserver(() => publishHeight()) : null;
	observer?.observe(elements.root);
	publishHeight();

	return {
		render: (view) => dispatch(sheetEventOf(view)),
		destroy: () => {
			dispatch({ kind: 'hidden' });
			observer?.disconnect();
			historyEntry.destroy();
			map.off('click', closeByUser);
			elements.root.remove();
		},
	};
}
