/**
 * "Show my location" map control
 */

import * as L from 'leaflet';
import { isActivationKey } from '../utils/dom';

/**
 * Accessible label of the locate button
 */
export const LOCATE_CONTROL_LABEL = 'Show my location';

/**
 * Create the locate control. The button is keyboard operable (Enter/Space) and
 * invokes `onActivate` on every activation.
 * @param onActivate - Called when the user asks to be located
 * @param position - Leaflet control position (default: top right)
 */
export function createLocateControl(
	onActivate: () => void,
	position: L.ControlPosition = 'topright'
): L.Control {
	const LocateControl = L.Control.extend({
		onAdd: (): HTMLElement => {
			const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control locate-control');
			const link = L.DomUtil.create('a', '', container);
			link.href = '#';
			link.title = LOCATE_CONTROL_LABEL;
			link.setAttribute('aria-label', LOCATE_CONTROL_LABEL);
			link.setAttribute('role', 'button');
			link.setAttribute('tabindex', '0');
			link.innerHTML = '📍';

			L.DomEvent.on(link, 'click', (event: Event) => {
				L.DomEvent.preventDefault(event);
				L.DomEvent.stopPropagation(event);
				onActivate();
			});

			link.addEventListener('keydown', (event: KeyboardEvent) => {
				if (isActivationKey(event)) {
					event.preventDefault();
					onActivate();
				}
			});

			return container;
		},
	});

	const control: L.Control = new LocateControl({ position });
	return control;
}
