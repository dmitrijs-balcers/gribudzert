/**
 * Data fetching functionality
 * Generic facility data fetching from Overpass API
 */

import type * as L from 'leaflet';
import { OVERPASS_API_URL } from '../../core/config';
import type { FetchError } from '../../types/errors';
import type { Element, Overpass } from '../../types/overpass';
import type { Result } from '../../types/result';
import { Err, Ok } from '../../types/result';

/**
 * Fetch facilities from Overpass API
 * @param query - Overpass QL query string
 * @returns Result with elements or fetch error
 */
export async function fetchFacilities(query: string): Promise<Result<Element[], FetchError>> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

		const response = await fetch(OVERPASS_API_URL, {
			method: 'POST',
			body: `data=${encodeURIComponent(query)}`,
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			return Err({
				type: 'network',
				message: `HTTP error! status: ${response.status}`,
			});
		}

		const data: Overpass = await response.json();
		return Ok(data.elements);
	} catch (err) {
		if (err instanceof Error) {
			if (err.name === 'AbortError') {
				return Err({
					type: 'timeout',
					message: 'Request timed out after 30 seconds',
				});
			}
			return Err({
				type: 'network',
				message: err.message,
			});
		}
		return Err({
			type: 'network',
			message: 'Unknown error occurred during fetch',
		});
	}
}

/**
 * Fetch facilities within specific map bounds
 * @param query - Overpass QL query string with [bbox] placeholder
 * @param bounds - Leaflet LatLngBounds for the visible map area
 * @returns Result with elements or fetch error
 */
export async function fetchFacilitiesInBounds(
	query: string,
	bounds: L.LatLngBounds
): Promise<Result<Element[], FetchError>> {
	// Convert Leaflet bounds to Overpass format (south,west,north,east)
	const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

	// Inject bbox into query - replace [bbox] placeholder
	const modifiedQuery = query.replace(/\[bbox\]/g, bbox);

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

		const response = await fetch(OVERPASS_API_URL, {
			method: 'POST',
			body: `data=${encodeURIComponent(modifiedQuery)}`,
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			return Err({
				type: 'network',
				message: `HTTP error! status: ${response.status}`,
			});
		}

		const data: Overpass = await response.json();
		return Ok(data.elements);
	} catch (err) {
		if (err instanceof Error) {
			if (err.name === 'AbortError') {
				return Err({
					type: 'timeout',
					message: 'Request timed out after 30 seconds',
				});
			}
			return Err({
				type: 'network',
				message: err.message,
			});
		}
		return Err({
			type: 'network',
			message: 'Unknown error occurred during fetch',
		});
	}
}

// Backward compatibility aliases for existing water point code
/**
 * @deprecated Use fetchFacilities instead
 */
export const fetchWaterPoints = fetchFacilities;

/**
 * @deprecated Use fetchFacilitiesInBounds instead
 */
export const fetchWaterPointsInBounds = fetchFacilitiesInBounds;
