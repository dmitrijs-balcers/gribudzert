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
 * Fallback wait before retrying a busy response when the server gave no usable `Retry-After`
 */
export const BUSY_RETRY_DELAY_MS = 3_000;

/**
 * Longest `Retry-After` we honour; anything longer falls back to `BUSY_RETRY_DELAY_MS`
 */
export const MAX_RETRY_AFTER_MS = 10_000;

/**
 * HTTP statuses that mean "the server is busy", not "something is broken"
 */
const BUSY_STATUSES: ReadonlySet<number> = new Set([429, 503, 504]);

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
 * Parse a `Retry-After` header given as a whole number of seconds. The HTTP-date form and
 * anything else non-numeric is treated as unknown (`null`).
 */
const parseRetryAfterMs = (header: string | null): number | null => {
	if (header === null || !/^\d+$/.test(header.trim())) {
		return null;
	}
	return Number(header.trim()) * 1000;
};

/**
 * Map a non-2xx response to a FetchError. 429/503/504 mean the server is busy, not that the
 * client has a connectivity problem.
 */
const toResponseError = (response: Response): FetchError => {
	if (BUSY_STATUSES.has(response.status)) {
		return {
			type: 'busy',
			status: response.status,
			retryAfterMs: parseRetryAfterMs(response.headers.get('Retry-After')),
			message: `Overpass is busy (status ${response.status})`,
		};
	}
	return { type: 'network', message: `HTTP error! status: ${response.status}` };
};

/**
 * How long to wait before retrying a busy response: the server's own `Retry-After` when it is
 * usable and not excessive, otherwise the fixed default.
 */
const retryDelayMs = (retryAfterMs: number | null): number =>
	retryAfterMs !== null && retryAfterMs <= MAX_RETRY_AFTER_MS ? retryAfterMs : BUSY_RETRY_DELAY_MS;

/**
 * Wait `ms` milliseconds, or reject with an `AbortError` if `signal` aborts first. Mirrors the
 * shape of a genuinely aborted fetch so callers can handle both the same way.
 */
const delay = (ms: number, signal: AbortSignal): Promise<void> =>
	new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(new DOMException('The operation was aborted.', 'AbortError'));
			return;
		}
		const onAbort = (): void => {
			clearTimeout(timer);
			reject(new DOMException('The operation was aborted.', 'AbortError'));
		};
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		signal.addEventListener('abort', onAbort, { once: true });
	});

/**
 * Run one Overpass request and turn its response into facilities or a FetchError
 */
const requestOnce = async (
	query: string,
	bounds: L.LatLngBounds,
	signal: AbortSignal
): Promise<Result<readonly Facility[], FetchError>> => {
	const response = await fetch(OVERPASS_API_URL, {
		method: 'POST',
		body: `data=${encodeURIComponent(injectBbox(query, bounds))}`,
		signal,
	});

	if (!response.ok) {
		return Err(toResponseError(response));
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
};

/**
 * Fetch facilities inside the given bounds. A busy server (429/503/504) is retried once, after
 * waiting for its `Retry-After` (capped at `MAX_RETRY_AFTER_MS`) or `BUSY_RETRY_DELAY_MS`;
 * a busy result from the retry is returned as-is.
 * @param query - Overpass QL query containing `[bbox]` placeholders
 * @param bounds - Visible map area
 * @param signal - Optional caller signal; aborting it yields `{ type: 'aborted' }`
 * @returns Validated facilities, or a FetchError (`network`, `busy`, `parse`, `timeout`, `aborted`)
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
	const combinedSignal = linkSignals(timeoutController.signal, signal);

	try {
		const first = await requestOnce(query, bounds, combinedSignal);
		if (isErr(first) && first.error.type === 'busy') {
			await delay(retryDelayMs(first.error.retryAfterMs), combinedSignal);
			return await requestOnce(query, bounds, combinedSignal);
		}
		return first;
	} catch (error) {
		return Err(toFetchError(error, timedOut));
	} finally {
		clearTimeout(timeoutId);
	}
}
