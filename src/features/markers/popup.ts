/**
 * Popup content and interaction handling
 */

import type * as L from 'leaflet';
import { trackMarkerClicked, trackNavigationStarted } from '../../analytics';
import type {
	Facility,
	Located,
	ToiletFacility,
	WaterFacility,
	WaterSourceType,
} from '../../domain';
import { formatDistance, osmUrl } from '../../domain';
import { escapeHtml } from '../../utils/html';
import * as logger from '../../utils/logger';
import { openNavigation } from '../navigation/navigation';

/**
 * Presentation of a water source type
 */
type SourcePresentation = {
	readonly label: string;
	readonly icon: string;
	readonly color: string;
};

const WATER_SOURCE_PRESENTATION: Readonly<Record<WaterSourceType, SourcePresentation>> = {
	spring: { label: 'Natural Spring', icon: '💧', color: '#00BCD4' },
	water_well: { label: 'Water Well', icon: '🪣', color: '#795548' },
	water_tap: { label: 'Water Tap', icon: '🚰', color: '#2196F3' },
	water_point: { label: 'Water Point', icon: '🌊', color: '#009688' },
	drinking_water: { label: 'Drinking Water', icon: '🚰', color: '#4CAF50' },
};

/**
 * Human readable label used in navigation labels and aria attributes
 */
const navigationLabel = (facility: Facility): string =>
	facility.kind === 'toilet' ? 'toilet' : 'water_tap';

/**
 * Title block shared by all popups
 */
const titleHtml = (facility: Facility, color: string, heading: string): string =>
	`<strong style="color: ${color};">${heading}</strong>` +
	`<div style="font-size: 0.85em; color: #666;">ID: ${facility.osm.id}</div>` +
	(facility.name !== undefined ? `<div><strong>${escapeHtml(facility.name)}</strong></div>` : '');

/**
 * Optional free-text details shared by all popups
 */
const detailsHtml = (facility: Facility): readonly string[] => {
	const parts: string[] = [];
	if (facility.operator !== undefined) {
		parts.push(`<div>Operator: ${escapeHtml(facility.operator)}</div>`);
	}
	if (facility.note !== undefined) {
		parts.push(`<div>Note: ${escapeHtml(facility.note)}</div>`);
	}
	return parts;
};

/**
 * Navigate button and OSM link
 */
const actionsHtml = (facility: Facility, ariaTarget: string): string =>
	`<div class="popup-actions">` +
	`<button type="button" class="navigate-btn" data-lat="${facility.coordinates.lat}" data-lon="${facility.coordinates.lon}" aria-label="Navigate to ${ariaTarget} ${facility.osm.id}">` +
	`<span class="icon" aria-hidden="true">🧭</span>` +
	`<span class="label">Navigate</span>` +
	`</button>` +
	`<a class="popup-secondary" target="_blank" rel="noreferrer" href="${osmUrl(facility.osm)}">` +
	`Open on OpenStreetMap` +
	`</a>` +
	`</div>`;

/**
 * Create HTML content for toilet popup
 */
function createToiletPopupContent(item: Located<ToiletFacility>): string {
	const { facility, distance } = item;
	const parts: string[] = [];

	parts.push(titleHtml(facility, '#795548', '🚻 Public Toilet'));
	parts.push(`<div><strong>Distance: ${formatDistance(distance)}</strong></div>`);

	// Accessibility information
	switch (facility.accessibility.wheelchair) {
		case 'yes':
			parts.push(
				`<div style="background: #E8F5E9; border-left: 3px solid #4CAF50; padding: 8px; margin: 8px 0; border-radius: 4px;">` +
					`<strong style="color: #2E7D32;">♿ Wheelchair Accessible</strong>` +
					`</div>`
			);
			break;
		case 'no':
			parts.push(`<div>♿ Not wheelchair accessible</div>`);
			break;
		case 'limited':
			parts.push(`<div>♿ Limited wheelchair access</div>`);
			break;
		case 'unknown':
			parts.push(`<div style="color: #666;">♿ Accessibility information unavailable</div>`);
			break;
	}

	// Changing table
	if (facility.accessibility.changingTable === 'yes') {
		parts.push(`<div>🍼 Baby changing table available</div>`);
	} else if (facility.accessibility.changingTable === 'no') {
		parts.push(`<div>🍼 No changing table</div>`);
	}

	// Fee status
	if (facility.fee === 'yes') {
		parts.push(`<div>💵 Fee required</div>`);
	} else if (facility.fee === 'no') {
		parts.push(`<div>✅ Free</div>`);
	}

	// Opening hours
	if (facility.openingHours !== undefined) {
		parts.push(`<div>🕒 Hours: ${escapeHtml(facility.openingHours)}</div>`);
	} else {
		parts.push(`<div style="color: #666;">🕒 Hours: 24/7 (assumed)</div>`);
	}

	// Unisex/gendered
	if (facility.unisex === true) {
		parts.push(`<div>Gender-neutral facility</div>`);
	}

	parts.push(...detailsHtml(facility));
	parts.push(actionsHtml(facility, 'toilet'));

	return parts.join('');
}

/**
 * Create HTML content for water popup
 */
function createWaterPopupContent(item: Located<WaterFacility>): string {
	const { facility, distance, isNearest } = item;
	const parts: string[] = [];
	const source = WATER_SOURCE_PRESENTATION[facility.sourceType];

	parts.push(
		titleHtml(
			facility,
			facility.drinkable ? source.color : '#FF5722',
			`${source.icon} ${source.label}`
		)
	);

	// Non-drinkable warning
	if (!facility.drinkable) {
		parts.push(
			`<div style="background: #FFF3E0; border-left: 3px solid #FF9800; padding: 8px; margin: 8px 0; border-radius: 4px;">` +
				`<strong style="color: #F57C00;">⚠️ Not Drinkable</strong><br>` +
				`<span style="font-size: 0.9em; color: #666;">This water source is not safe for drinking.</span>` +
				`</div>`
		);
	}

	parts.push(`<div><strong>Distance: ${formatDistance(distance)}</strong></div>`);

	// Nearest marker indicator
	if (isNearest) {
		parts.push(`<div style="color: #FFD700;">⭐ Nearest water point</div>`);
	}

	parts.push(...detailsHtml(facility));
	if (facility.seasonal) {
		parts.push(`<div>Seasonal: yes</div>`);
	}
	if (facility.bottleRefill) {
		parts.push(`<div>Bottle refill: yes</div>`);
	}
	if (facility.wheelchair !== 'unknown') {
		parts.push(`<div>Wheelchair: ${facility.wheelchair}</div>`);
	}
	if (facility.openingHours !== undefined) {
		parts.push(`<div>🕒 Hours: ${escapeHtml(facility.openingHours)}</div>`);
	}

	parts.push(actionsHtml(facility, source.label.toLowerCase()));

	return parts.join('');
}

/**
 * Create HTML content for a facility popup
 */
export function createPopupContent(item: Located<Facility>): string {
	const { facility } = item;
	switch (facility.kind) {
		case 'toilet':
			return createToiletPopupContent({ ...item, facility });
		case 'water':
			return createWaterPopupContent({ ...item, facility });
	}
}

/**
 * Attach event handlers to a marker's popup
 */
export function attachPopupHandlers(marker: L.CircleMarker | L.Marker, facility: Facility): void {
	// Track marker click when popup opens
	marker.on('popupopen', (e: L.PopupEvent) => {
		trackMarkerClicked(facility.kind);

		try {
			const popupEl = e.popup.getElement();
			if (!popupEl) return;

			// Handle navigation button
			const navBtn = popupEl.querySelector('.navigate-btn');
			if (navBtn && !(navBtn as unknown as { __bound?: boolean }).__bound) {
				(navBtn as unknown as { __bound: boolean }).__bound = true;

				navBtn.addEventListener('click', (ev) => {
					ev.preventDefault();
					trackNavigationStarted(facility.kind);

					const lat = navBtn.getAttribute('data-lat');
					const lon = navBtn.getAttribute('data-lon');
					if (lat && lon) {
						openNavigation(lat, lon, `${navigationLabel(facility)} ${facility.osm.id}`);
					}
				});

				// Accessibility: keyboard navigation
				navBtn.setAttribute('tabindex', '0');
				navBtn.setAttribute('role', 'button');
			}

			// Ensure OSM link is keyboard-friendly
			const osmLink = popupEl.querySelector('.popup-secondary');
			if (osmLink) {
				osmLink.setAttribute('role', 'link');
				osmLink.setAttribute('tabindex', '0');
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			logger.info('Failed to attach popup action handlers:', message);
		}
	});
}
