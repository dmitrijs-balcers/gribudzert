/**
 * Popup content and interaction handling
 */

import type * as L from 'leaflet';
import type { Element } from '../../types/overpass';
import { escapeHtml } from '../../utils/html';
import * as logger from '../../utils/logger';
import { openNavigation } from '../navigation/navigation';

/**
 * Get user-friendly label and icon for water source type
 */
function getWaterSourceLabel(element: Element): { label: string; icon: string; color: string } {
	if (element.tags.natural === 'spring') {
		return { label: 'Natural Spring', icon: '💧', color: '#00BCD4' };
	}
	if (element.tags.man_made === 'water_well') {
		return { label: 'Water Well', icon: '🪣', color: '#795548' };
	}
	if (element.tags.man_made === 'water_tap') {
		return { label: 'Water Tap', icon: '🚰', color: '#2196F3' };
	}
	if (element.tags.waterway === 'water_point') {
		return { label: 'Water Point', icon: '🌊', color: '#009688' };
	}
	if (element.tags.amenity === 'drinking_water') {
		return { label: 'Drinking Water', icon: '🚰', color: '#4CAF50' };
	}
	return { label: 'Water Source', icon: '💧', color: '#0078ff' };
}

/**
 * Check if element is a toilet
 */
function isToilet(element: Element): boolean {
	return element.tags.amenity === 'toilets';
}

/**
 * Check if water is drinkable
 */
function isDrinkable(element: Element): boolean {
	const drinkingWater = (element.tags.drinking_water || '').toLowerCase();
	return drinkingWater !== 'no';
}

/**
 * Create HTML content for toilet popup
 */
function createToiletPopupContent(element: Element): string {
	const parts: string[] = [];

	// Title with icon
	parts.push(
		`<strong style="color: #795548;">` +
			`🚻 Public Toilet` +
			`</strong>` +
			`<div style="font-size: 0.85em; color: #666;">ID: ${element.id}</div>`
	);

	// Distance (if available)
	if (element.distanceFromUser !== undefined) {
		const distanceKm = element.distanceFromUser / 1000;
		const distanceStr =
			distanceKm < 1 ? `${Math.round(element.distanceFromUser)}m` : `${distanceKm.toFixed(2)}km`;
		parts.push(`<div><strong>Distance: ${distanceStr}</strong></div>`);
	}

	// Accessibility information
	const wheelchair = (element.tags.wheelchair || '').toLowerCase();
	if (wheelchair === 'yes') {
		parts.push(
			`<div style="background: #E8F5E9; border-left: 3px solid #4CAF50; padding: 8px; margin: 8px 0; border-radius: 4px;">` +
				`<strong style="color: #2E7D32;">♿ Wheelchair Accessible</strong>` +
				`</div>`
		);
	} else if (wheelchair === 'no') {
		parts.push(`<div>♿ Not wheelchair accessible</div>`);
	} else if (wheelchair === 'limited') {
		parts.push(`<div>♿ Limited wheelchair access</div>`);
	} else {
		parts.push(`<div style="color: #666;">♿ Accessibility information unavailable</div>`);
	}

	// Changing table
	const changingTable = (element.tags.changing_table || '').toLowerCase();
	if (changingTable === 'yes') {
		parts.push(`<div>🍼 Baby changing table available</div>`);
	} else if (changingTable === 'no') {
		parts.push(`<div>🍼 No changing table</div>`);
	}

	// Fee status
	const fee = (element.tags.fee || '').toLowerCase();
	if (fee === 'yes') {
		parts.push(`<div>💵 Fee required</div>`);
	} else if (fee === 'no') {
		parts.push(`<div>✅ Free</div>`);
	}

	// Opening hours
	if (element.tags.opening_hours) {
		parts.push(`<div>🕒 Hours: ${escapeHtml(element.tags.opening_hours)}</div>`);
	} else {
		parts.push(`<div style="color: #666;">🕒 Hours: 24/7 (assumed)</div>`);
	}

	// Unisex/gendered
	const unisex = (element.tags.unisex || '').toLowerCase();
	if (unisex === 'yes') {
		parts.push(`<div>Gender-neutral facility</div>`);
	}

	// Additional information
	if (element.tags.operator) {
		parts.push(`<div>Operator: ${escapeHtml(element.tags.operator)}</div>`);
	}
	if (element.tags.note) {
		parts.push(`<div>Note: ${escapeHtml(element.tags.note)}</div>`);
	}

	// Actions
	parts.push(
		`<div class="popup-actions">` +
			`<button type="button" class="navigate-btn" data-lat="${element.lat}" data-lon="${element.lon}" aria-label="Navigate to toilet ${element.id}">` +
			`<span class="icon" aria-hidden="true">🧭</span>` +
			`<span class="label">Navigate</span>` +
			`</button>` +
			`<a class="popup-secondary" target="_blank" rel="noreferrer" href="https://www.openstreetmap.org/node/${element.id}">` +
			`Open on OpenStreetMap` +
			`</a>` +
			`</div>`
	);

	return parts.join('');
}

/**
 * Create HTML content for water popup
 */
function createWaterPopupContent(element: Element): string {
	const parts: string[] = [];
	const sourceInfo = getWaterSourceLabel(element);
	const drinkable = isDrinkable(element);

	// Title with type and icon
	parts.push(
		`<strong style="color: ${drinkable ? sourceInfo.color : '#FF5722'};">` +
			`${sourceInfo.icon} ${sourceInfo.label}` +
			`</strong>` +
			`<div style="font-size: 0.85em; color: #666;">ID: ${element.id}</div>`
	);

	// Non-drinkable warning
	if (!drinkable) {
		parts.push(
			`<div style="background: #FFF3E0; border-left: 3px solid #FF9800; padding: 8px; margin: 8px 0; border-radius: 4px;">` +
				`<strong style="color: #F57C00;">⚠️ Not Drinkable</strong><br>` +
				`<span style="font-size: 0.9em; color: #666;">This water source is not safe for drinking.</span>` +
				`</div>`
		);
	}

	// Distance (if available)
	if (element.distanceFromUser !== undefined) {
		const distanceKm = element.distanceFromUser / 1000;
		const distanceStr =
			distanceKm < 1 ? `${Math.round(element.distanceFromUser)}m` : `${distanceKm.toFixed(2)}km`;
		parts.push(`<div><strong>Distance: ${distanceStr}</strong></div>`);
	}

	// Nearest marker indicator
	if (element.isNearest) {
		parts.push(`<div style="color: #FFD700;">⭐ Nearest water point</div>`);
	}

	// Tags
	if (element.tags.operator) {
		parts.push(`<div>Operator: ${escapeHtml(element.tags.operator)}</div>`);
	}
	if (element.tags.note) {
		parts.push(`<div>Note: ${escapeHtml(element.tags.note)}</div>`);
	}
	if (element.tags.seasonal) {
		parts.push(`<div>Seasonal: ${escapeHtml(element.tags.seasonal)}</div>`);
	}
	if (element.tags.bottle) {
		parts.push(`<div>Bottle refill: ${escapeHtml(element.tags.bottle)}</div>`);
	}
	if (element.tags.wheelchair) {
		parts.push(`<div>Wheelchair: ${escapeHtml(element.tags.wheelchair)}</div>`);
	}

	// Actions
	parts.push(
		`<div class="popup-actions">` +
			`<button type="button" class="navigate-btn" data-lat="${element.lat}" data-lon="${element.lon}" aria-label="Navigate to ${sourceInfo.label.toLowerCase()} ${element.id}">` +
			`<span class="icon" aria-hidden="true">🧭</span>` +
			`<span class="label">Navigate</span>` +
			`</button>` +
			`<a class="popup-secondary" target="_blank" rel="noreferrer" href="https://www.openstreetmap.org/node/${element.id}">` +
			`Open on OpenStreetMap` +
			`</a>` +
			`</div>`
	);

	return parts.join('');
}

/**
 * Create HTML content for popup
 */
export function createPopupContent(element: Element): string {
	// Route to appropriate popup content based on facility type
	if (isToilet(element)) {
		return createToiletPopupContent(element);
	}
	return createWaterPopupContent(element);
}

/**
 * Attach event handlers to popup
 */
export function attachPopupHandlers(marker: L.CircleMarker, element: Element): void {
	marker.on('popupopen', (e) => {
		try {
			const popupEl = e.popup.getElement();
			if (!popupEl) return;

			// Determine facility type for navigation label
			const facilityType = isToilet(element) ? 'toilet' : 'water_tap';

			// Handle navigation button
			const navBtn = popupEl.querySelector('.navigate-btn');
			if (navBtn && !(navBtn as unknown as { __bound?: boolean }).__bound) {
				(navBtn as unknown as { __bound: boolean }).__bound = true;

				navBtn.addEventListener('click', (ev) => {
					ev.preventDefault();
					const lat = navBtn.getAttribute('data-lat');
					const lon = navBtn.getAttribute('data-lon');
					if (lat && lon) {
						openNavigation(lat, lon, `${facilityType} ${element.id}`);
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
