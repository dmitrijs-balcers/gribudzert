/**
 * Popup content and interaction handling
 */

import type * as L from 'leaflet';
import type { Element } from '../../types/overpass';
import { escapeHtml } from '../../utils/html';
import { openNavigation } from '../navigation/navigation';
import * as logger from '../../utils/logger';

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
 * Create HTML content for popup
 */
export function createPopupContent(element: Element): string {
	const parts: string[] = [];
	const sourceInfo = getWaterSourceLabel(element);

	// Title with type and icon
	parts.push(
		`<strong style="color: ${sourceInfo.color};">` +
		`${sourceInfo.icon} ${sourceInfo.label}` +
		`</strong>` +
		`<div style="font-size: 0.85em; color: #666;">ID: ${element.id}</div>`
	);

	// Distance (if available)
	if (element.distanceFromUser !== undefined) {
		const distanceKm = element.distanceFromUser / 1000;
		const distanceStr =
			distanceKm < 1
				? `${Math.round(element.distanceFromUser)}m`
				: `${distanceKm.toFixed(2)}km`;
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
 * Attach event handlers to popup
 */
export function attachPopupHandlers(marker: L.CircleMarker, element: Element): void {
	marker.on('popupopen', (e) => {
		try {
			const popupEl = e.popup.getElement();
			if (!popupEl) return;

			// Handle navigation button
			const navBtn = popupEl.querySelector('.navigate-btn');
			if (navBtn && !(navBtn as unknown as { __bound?: boolean }).__bound) {
				(navBtn as unknown as { __bound: boolean }).__bound = true;

				navBtn.addEventListener('click', (ev) => {
					ev.preventDefault();
					const lat = navBtn.getAttribute('data-lat');
					const lon = navBtn.getAttribute('data-lon');
					if (lat && lon) {
						openNavigation(lat, lon, `water_tap ${element.id}`);
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
