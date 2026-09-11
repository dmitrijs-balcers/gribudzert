import * as L from 'leaflet';
import type { Heading, Meters } from '../domain';
import { formatDistance } from '../domain';
import type { Glyph } from '../features/presentation';

export type GuidanceHudView =
	| { readonly kind: 'hidden' }
	| {
			readonly kind: 'shown';
			readonly distance: Meters;
			readonly bearing: Heading;
			readonly glyph: Glyph;
			readonly title: string;
			readonly label: string;
			readonly dismissible: boolean;
	  };

export type GuidanceHudHandlers = {
	readonly onActivate: () => void;
	readonly onDismiss: () => void;
};

export type GuidanceHud = {
	readonly render: (view: GuidanceHudView) => void;
};

export const STOP_GUIDING_LABEL = 'Stop guiding';

type TargetButton = {
	readonly button: HTMLButtonElement;
	readonly icon: HTMLSpanElement;
	readonly text: HTMLSpanElement;
	readonly arrow: HTMLSpanElement;
};

const createTargetButton = (): TargetButton => {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'guidance-hud-target';

	const icon = document.createElement('span');
	icon.className = 'guidance-hud-icon';
	icon.setAttribute('aria-hidden', 'true');

	const text = document.createElement('span');
	text.className = 'guidance-hud-text';

	const arrow = document.createElement('span');
	arrow.className = 'guidance-hud-arrow';
	arrow.setAttribute('aria-hidden', 'true');

	button.append(icon, text, arrow);
	return { button, icon, text, arrow };
};

const createDismissButton = (): HTMLButtonElement => {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'guidance-hud-dismiss';
	button.setAttribute('aria-label', STOP_GUIDING_LABEL);
	button.textContent = '×';
	button.hidden = true;
	return button;
};

const renderGlyph = (icon: HTMLSpanElement, glyph: Glyph): void => {
	switch (glyph.kind) {
		case 'emoji':
			icon.textContent = glyph.char;
			return;
		case 'svg':
			icon.innerHTML = glyph.markup;
			return;
		default: {
			const exhaustive: never = glyph;
			throw new Error(`Unhandled glyph: ${JSON.stringify(exhaustive)}`);
		}
	}
};

export function createGuidanceHud(map: L.Map, handlers: GuidanceHudHandlers): GuidanceHud {
	const root = document.createElement('div');
	root.className = 'guidance-hud';
	root.setAttribute('aria-live', 'polite');
	root.hidden = true;

	const target = createTargetButton();
	const dismiss = createDismissButton();
	root.append(target.button, dismiss);

	L.DomEvent.disableClickPropagation(root);
	L.DomEvent.disableScrollPropagation(root);
	target.button.addEventListener('click', handlers.onActivate);
	dismiss.addEventListener('click', handlers.onDismiss);

	map.getContainer().appendChild(root);

	const render = (view: GuidanceHudView): void => {
		switch (view.kind) {
			case 'hidden':
				root.hidden = true;
				return;
			case 'shown':
				root.hidden = false;
				renderGlyph(target.icon, view.glyph);
				target.text.textContent = `${view.title} · ${formatDistance(view.distance)} · ${view.label}`;
				target.arrow.style.setProperty('--bearing', `${view.bearing}deg`);
				dismiss.hidden = !view.dismissible;
				return;
			default: {
				const exhaustive: never = view;
				throw new Error(`Unhandled guidance HUD view: ${JSON.stringify(exhaustive)}`);
			}
		}
	};

	return { render };
}
