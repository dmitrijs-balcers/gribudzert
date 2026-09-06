import * as L from 'leaflet';
import type { FollowMode } from '../features/location/follow';

export const LOCATE_CONTROL_LABEL = 'Show my location';

export const LOCATE_CONTROL_BLOCKED_LABEL =
	"Location access is blocked. Allow it in your browser's site settings.";

export type LocateButtonView =
	| { readonly kind: 'idle' }
	| { readonly kind: 'acquiring' }
	| { readonly kind: 'tracking'; readonly follow: FollowMode }
	| { readonly kind: 'blocked' }
	| { readonly kind: 'failed' };

export type LocateControl = {
	readonly control: L.Control;
	readonly render: (view: LocateButtonView) => void;
};

const ICON_MARKUP = `
	<span class="locate-control-ring" aria-hidden="true"></span>
	<svg class="locate-control-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<circle class="locate-control-dot" cx="12" cy="12" r="6"></circle>
		<line x1="12" y1="1" x2="12" y2="5"></line>
		<line x1="12" y1="19" x2="12" y2="23"></line>
		<line x1="1" y1="12" x2="5" y2="12"></line>
		<line x1="19" y1="12" x2="23" y2="12"></line>
		<line class="locate-control-slash" x1="3" y1="3" x2="21" y2="21"></line>
	</svg>
`;

const applyView = (button: HTMLButtonElement, view: LocateButtonView): void => {
	button.setAttribute('data-state', view.kind);
	button.removeAttribute('data-follow');
	button.removeAttribute('aria-busy');
	button.removeAttribute('aria-pressed');
	button.title = LOCATE_CONTROL_LABEL;
	button.setAttribute('aria-label', LOCATE_CONTROL_LABEL);

	switch (view.kind) {
		case 'idle':
		case 'failed':
			return;
		case 'acquiring':
			button.setAttribute('aria-busy', 'true');
			return;
		case 'tracking':
			button.setAttribute('data-follow', view.follow);
			button.setAttribute('aria-pressed', view.follow === 'on' ? 'true' : 'false');
			return;
		case 'blocked':
			button.title = LOCATE_CONTROL_BLOCKED_LABEL;
			button.setAttribute('aria-label', LOCATE_CONTROL_BLOCKED_LABEL);
			return;
		default: {
			const exhaustive: never = view;
			throw new Error(`Unhandled locate button view: ${JSON.stringify(exhaustive)}`);
		}
	}
};

export function createLocateControl(
	onActivate: () => void,
	position: L.ControlPosition = 'topright'
): LocateControl {
	let button: HTMLButtonElement | null = null;

	const LocateControlImpl = L.Control.extend({
		onAdd: (): HTMLElement => {
			const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control locate-control');
			const created = L.DomUtil.create('button', 'locate-control-button', container);
			if (!(created instanceof HTMLButtonElement)) {
				throw new Error('Failed to create locate control button');
			}
			button = created;
			button.type = 'button';
			button.innerHTML = ICON_MARKUP;
			L.DomEvent.disableClickPropagation(container);
			L.DomEvent.on(button, 'click', () => onActivate());
			applyView(button, { kind: 'idle' });
			return container;
		},
	});

	const control: L.Control = new LocateControlImpl({ position });

	return {
		control,
		render: (view) => {
			if (button !== null) {
				applyView(button, view);
			}
		},
	};
}
