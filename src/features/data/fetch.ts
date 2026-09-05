/**
 * Facility fetching
 * The single entry point for loading facilities from the Overpass API.
 */

import type * as L from 'leaflet';
import { OVERPASS_API_URL } from '../../core/config';
import type { Facility } from '../../domain';
import type { FetchError } from '../../types/errors';
import type { Result } from '../../types/result';
import { Err, isErr, Ok } from '../../types/result';
import { parseOverpassResponse, toFacilities } from './overpass';

/**
 * How long a single Overpass request may take before it is abandoned
 */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Overpass bbox string (south,west,north,east) for Leaflet bounds
 */
export const toBbox = (bounds: L.LatLngBounds): string =>
	`${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

/**
 * Replace every `[bbox]` placeholder in an Overpass QL query with the given bounds
 */
export const injectBbox = (query: string, bounds: L.LatLngBounds): string =>
	query.replace(/\[bbox\]/g, toBbox(bounds));

/**
 * Whether a thrown value is a DOM `AbortError`
 */
const isAbortError = (error: unknown): boolean =>
	typeof error === 'object' &&
	error !== null &&
	'name' in error &&
	(error as { readonly name: unknown }).name === 'AbortError';

/**
 * Combine the internal timeout signal with the caller's optional signal
 */
const linkSignals = (timeoutSignal: AbortSignal, external?: AbortSignal): AbortSignal => {
	if (external === undefined) {
		return timeoutSignal;
	}
	if (typeof AbortSignal.any === 'function') {
		return AbortSignal.any([timeoutSignal, external]);
	}
	const controller = new AbortController();
	if (timeoutSignal.aborted || external.aborted) {
		controller.abort();
		return controller.signal;
	}
	const forward = (): void => controller.abort();
	timeoutSignal.addEventListener('abort', forward, { once: true });
	external.addEventListener('abort', forward, { once: true });
	return controller.signal;
};

/**
 * Map a thrown value to a FetchError. An abort is a timeout only when our own timer fired.
 */
const toFetchError = (error: unknown, timedOut: boolean): FetchError => {
	if (isAbortError(error)) {
		return timedOut
			? { type: 'timeout', message: `Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds` }
			: { type: 'aborted', message: 'Request was cancelled' };
	}
	if (error instanceof Error) {
		return { type: 'network', message: error.message };
	}
	return { type: 'network', message: 'Unknown error occurred during fetch' };
};

/**
 * Read and decode the JSON body. Aborts propagate; anything else is a parse error.
 */
const readJson = async (response: Response): Promise<Result<unknown, FetchError>> => {
	try {
		const json: unknown = await response.json();
		return Ok(json);
	} catch (error) {
		if (isAbortError(error)) {
			throw error;
		}
		return Err({ type: 'parse', message: 'Overpass response body is not valid JSON' });
	}
};

/**
 * Fetch facilities inside the given bounds.
 * @param query - Overpass QL query containing `[bbox]` placeholders
 * @param bounds - Visible map area
 * @param signal - Optional caller signal; aborting it yields `{ type: 'aborted' }`
 * @returns Validated facilities, or a FetchError (`network`, `parse`, `timeout`, `aborted`)
 */
export async function fetchFacilities(
	query: string,
	bounds: L.LatLngBounds,
	signal?: AbortSignal
): Promise<Result<readonly Facility[], FetchError>> {
	if (signal?.aborted) {
		return Err({ type: 'aborted', message: 'Request was cancelled before it started' });
	}

	const timeoutController = new AbortController();
	let timedOut = false;
	const timeoutId = setTimeout(() => {
		timedOut = true;
		timeoutController.abort();
	}, REQUEST_TIMEOUT_MS);

	try {
		const response = await fetch(OVERPASS_API_URL, {
			method: 'POST',
			body: `data=${encodeURIComponent(injectBbox(query, bounds))}`,
			signal: linkSignals(timeoutController.signal, signal),
		});

		if (!response.ok) {
			return Err({ type: 'network', message: `HTTP error! status: ${response.status}` });
		}

		const json = await readJson(response);
		if (isErr(json)) {
			return json;
		}

		const elements = parseOverpassResponse(json.value);
		if (isErr(elements)) {
			return elements;
		}

		return Ok(toFacilities(elements.value));
	} catch (error) {
		return Err(toFetchError(error, timedOut));
	} finally {
		clearTimeout(timeoutId);
	}
}
