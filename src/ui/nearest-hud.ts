import * as L from 'leaflet';
import type { Heading, Meters } from '../domain';
import { formatDistance } from '../domain';

export type NearestHudView =
	| { readonly kind: 'hidden' }
	| {
			readonly kind: 'shown';
			readonly distance: Meters;
			readonly bearing: Heading;
			readonly glyph: string;
			readonly label: string;
	  };

export type NearestHud = {
	readonly render: (view: NearestHudView) => void;
};

export function createNearestHud(map: L.Map, onActivate: () => void): NearestHud {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'nearest-hud';
	button.setAttribute('aria-live', 'polite');
	button.hidden = true;

	const icon = document.createElement('span');
	icon.className = 'nearest-hud-icon';
	icon.setAttribute('aria-hidden', 'true');

	const text = document.createElement('span');
	text.className = 'nearest-hud-text';

	const arrow = document.createElement('span');
	arrow.className = 'nearest-hud-arrow';
	arrow.setAttribute('aria-hidden', 'true');

	button.append(icon, text, arrow);
	L.DomEvent.disableClickPropagation(button);
	L.DomEvent.disableScrollPropagation(button);
	button.addEventListener('click', onActivate);

	map.getContainer().appendChild(button);

	const render = (view: NearestHudView): void => {
		switch (view.kind) {
			case 'hidden':
				button.hidden = true;
				return;
			case 'shown':
				button.hidden = false;
				icon.textContent = view.glyph;
				text.textContent = `Nearest water · ${formatDistance(view.distance)} · ${view.label}`;
				arrow.style.setProperty('--bearing', `${view.bearing}deg`);
				return;
			default: {
				const exhaustive: never = view;
				throw new Error(`Unhandled nearest HUD view: ${JSON.stringify(exhaustive)}`);
			}
		}
	};

	return { render };
}
