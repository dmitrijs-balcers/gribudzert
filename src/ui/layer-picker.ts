import * as L from 'leaflet';
import type { LayerName } from '../core/config';
import type { LayerKind } from '../app/layers';
import { VIEWPOINT_STARBURST_PATHS } from '../features/presentation';
import './layer-picker.css';

export const LAYER_PICKER_BUTTON_LABEL = 'Choose what to show on the map';
export const LAYER_PICKER_POPOVER_LABEL = 'Show on map';

export type LayerPickerLayer = {
	readonly kind: LayerKind;
	readonly label: LayerName;
};

export type LayerPickerOptions = {
	readonly layers: readonly LayerPickerLayer[];
	readonly onToggle: (kind: LayerKind, active: boolean) => void;
	readonly position?: L.ControlPosition;
};

export type LayerPicker = {
	readonly control: L.Control;
	readonly render: (state: Readonly<Record<LayerKind, boolean>>) => void;
	readonly close: () => void;
};

const BUTTON_ICON_MARKUP = `
	<svg class="layer-picker-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d="M12 3 2 8l10 5 10-5-10-5z"></path>
		<path d="m2 12 10 5 10-5"></path>
		<path d="m2 16 10 5 10-5"></path>
	</svg>
`;

const BADGE_ICON_MARKUP = `
	<span class="layer-picker-tile-badge" aria-hidden="true">
		<svg viewBox="0 0 24 24" focusable="false">
			<path d="M5 12l4 4 10-10"></path>
		</svg>
	</span>
`;

const TILE_ICON_MARKUP: Readonly<Record<LayerKind, string>> = {
	water:
		'<svg class="layer-picker-tile-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
		'<path d="M12 3.5 C9 8 6 11 6 14.5 a6 6 0 0 0 12 0 C18 11 15 8 12 3.5 Z"></path>' +
		'</svg>',
	toilet:
		'<svg class="layer-picker-tile-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
		'<circle cx="7.5" cy="5" r="2"></circle>' +
		'<path d="M7.5 9 v11 M4.5 14 v-3 a3 3 0 0 1 6 0 v3"></path>' +
		'<circle cx="16.5" cy="5" r="2"></circle>' +
		'<path d="M16.5 9 v11 M13.5 15 h6 l-1.5-5 a1.5 1.5 0 0 0-3 0 Z"></path>' +
		'</svg>',
	viewpoint: `<svg class="layer-picker-tile-svg layer-picker-tile-svg--fill" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${VIEWPOINT_STARBURST_PATHS}</svg>`,
};

const isCheckedTile = (tile: HTMLButtonElement): boolean =>
	tile.getAttribute('aria-checked') === 'true';

const setTileChecked = (tile: HTMLButtonElement, checked: boolean): void => {
	tile.setAttribute('aria-checked', checked ? 'true' : 'false');
};

const createTile = (
	layer: LayerPickerLayer,
	onToggle: (kind: LayerKind, active: boolean) => void
): HTMLButtonElement => {
	const tile = document.createElement('button');
	tile.type = 'button';
	tile.className = 'layer-picker-tile';
	tile.setAttribute('role', 'switch');
	tile.setAttribute('aria-checked', 'false');
	tile.dataset.layer = layer.kind;

	const iconBox = document.createElement('span');
	iconBox.className = 'layer-picker-tile-icon';
	iconBox.innerHTML = `${TILE_ICON_MARKUP[layer.kind]}${BADGE_ICON_MARKUP}`;

	const label = document.createElement('span');
	label.className = 'layer-picker-tile-label';
	label.textContent = layer.label;

	tile.append(iconBox, label);
	tile.addEventListener('click', () => onToggle(layer.kind, !isCheckedTile(tile)));

	return tile;
};

export function createLayerPicker(options: LayerPickerOptions): LayerPicker {
	const { layers, onToggle } = options;
	const position = options.position ?? 'topright';

	let button: HTMLButtonElement | null = null;
	let popover: HTMLElement | null = null;
	let tiles: ReadonlyMap<LayerKind, HTMLButtonElement> | null = null;

	const isOpen = (): boolean => popover !== null && !popover.hidden;

	const closePopover = (restoreFocus: boolean): void => {
		if (!isOpen() || popover === null) {
			return;
		}
		popover.hidden = true;
		button?.setAttribute('aria-expanded', 'false');
		if (restoreFocus) {
			button?.focus();
		}
	};

	const openPopover = (): void => {
		if (popover === null || button === null) {
			return;
		}
		popover.hidden = false;
		button.setAttribute('aria-expanded', 'true');
		const firstTile = popover.querySelector<HTMLButtonElement>('.layer-picker-tile');
		firstTile?.focus();
	};

	const togglePopover = (): void => {
		if (isOpen()) {
			closePopover(false);
		} else {
			openPopover();
		}
	};

	const onDocumentClick = (event: MouseEvent): void => {
		if (!isOpen()) {
			return;
		}
		const target = event.target;
		const insidePicker =
			target instanceof Node &&
			(popover?.contains(target) === true || button?.contains(target) === true);
		if (!insidePicker) {
			closePopover(false);
		}
	};

	const onDocumentKeyDown = (event: KeyboardEvent): void => {
		if (event.key === 'Escape' && isOpen()) {
			closePopover(true);
		}
	};

	const LayerPickerControl = L.Control.extend({
		onAdd: (map: L.Map): HTMLElement => {
			const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control layer-picker');
			const createdButton = L.DomUtil.create('button', 'layer-picker-button', container);
			if (!(createdButton instanceof HTMLButtonElement)) {
				throw new Error('Failed to create layer picker button');
			}
			button = createdButton;
			button.type = 'button';
			button.setAttribute('aria-label', LAYER_PICKER_BUTTON_LABEL);
			button.setAttribute('aria-haspopup', 'dialog');
			button.setAttribute('aria-expanded', 'false');
			button.innerHTML = BUTTON_ICON_MARKUP;

			const createdPopover = document.createElement('div');
			createdPopover.className = 'layer-picker-popover';
			createdPopover.setAttribute('role', 'dialog');
			createdPopover.setAttribute('aria-label', LAYER_PICKER_POPOVER_LABEL);
			createdPopover.hidden = true;

			const tileRow = document.createElement('div');
			tileRow.className = 'layer-picker-tiles';

			const createdTiles = new Map<LayerKind, HTMLButtonElement>();
			for (const layer of layers) {
				const tile = createTile(layer, onToggle);
				tileRow.appendChild(tile);
				createdTiles.set(layer.kind, tile);
			}
			tiles = createdTiles;

			createdPopover.appendChild(tileRow);
			map.getContainer().appendChild(createdPopover);
			popover = createdPopover;

			L.DomEvent.disableClickPropagation(container);
			L.DomEvent.disableScrollPropagation(container);
			L.DomEvent.disableClickPropagation(createdPopover);
			L.DomEvent.disableScrollPropagation(createdPopover);
			L.DomEvent.on(button, 'click', () => togglePopover());

			document.addEventListener('click', onDocumentClick, true);
			document.addEventListener('keydown', onDocumentKeyDown, true);

			return container;
		},
		onRemove: (): void => {
			document.removeEventListener('click', onDocumentClick, true);
			document.removeEventListener('keydown', onDocumentKeyDown, true);
			popover?.remove();
			popover = null;
			button = null;
			tiles = null;
		},
	});

	const control: L.Control = new LayerPickerControl({ position });

	return {
		control,
		render: (state) => {
			if (tiles === null) {
				return;
			}
			for (const [kind, tile] of tiles) {
				setTileChecked(tile, state[kind]);
			}
		},
		close: () => closePopover(false),
	};
}
