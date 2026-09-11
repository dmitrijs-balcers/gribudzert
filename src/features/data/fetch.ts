import type * as L from 'leaflet';
import { OVERPASS_API_URL } from '../../core/config';
import type { Facility } from '../../domain';
import type { FetchError } from '../../types/errors';
import type { Result } from '../../types/result';
import { Err, isErr, Ok } from '../../types/result';
import { parseOverpassResponse, toFacilities } from './overpass';

export const REQUEST_TIMEOUT_MS = 30_000;

export const BUSY_RETRY_DELAY_MS = 3_000;

export const MAX_RETRY_AFTER_MS = 10_000;

const BUSY_STATUSES: ReadonlySet<number> = new Set([429, 503, 504]);

export const toBbox = (bounds: L.LatLngBounds): string =>
	`${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

export const injectBbox = (query: string, bounds: L.LatLngBounds): string =>
	query.replace(/\[bbox\]/g, toBbox(bounds));

const isAbortError = (error: unknown): boolean =>
	typeof error === 'object' &&
	error !== null &&
	'name' in error &&
	(error as { readonly name: unknown }).name === 'AbortError';

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

type TimeoutSignal = {
	readonly signal: AbortSignal;
	readonly timedOut: () => boolean;
	readonly clear: () => void;
};

const timeoutSignal = (ms: number): TimeoutSignal => {
	const controller = new AbortController();
	let didTimeOut = false;
	const timeoutId = setTimeout(() => {
		didTimeOut = true;
		controller.abort();
	}, ms);
	return {
		signal: controller.signal,
		timedOut: () => didTimeOut,
		clear: () => clearTimeout(timeoutId),
	};
};

const toFetchError = (error: unknown, requestTimedOut: boolean): FetchError => {
	if (isAbortError(error)) {
		return requestTimedOut
			? { type: 'timeout', message: `Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds` }
			: { type: 'aborted', message: 'Request was cancelled' };
	}
	if (error instanceof Error) {
		return { type: 'network', message: error.message };
	}
	return { type: 'network', message: 'Unknown error occurred during fetch' };
};

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

const WHOLE_SECONDS = /^\d+$/;

const parseRetryAfterMs = (header: string | null): number | null => {
	if (header === null || !WHOLE_SECONDS.test(header.trim())) {
		return null;
	}
	return Number(header.trim()) * 1000;
};

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

const isUsableRetryAfter = (retryAfterMs: number | null): retryAfterMs is number =>
	retryAfterMs !== null && retryAfterMs <= MAX_RETRY_AFTER_MS;

const retryDelayMs = (retryAfterMs: number | null): number =>
	isUsableRetryAfter(retryAfterMs) ? retryAfterMs : BUSY_RETRY_DELAY_MS;

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

export async function fetchFacilities(
	query: string,
	bounds: L.LatLngBounds,
	signal?: AbortSignal
): Promise<Result<readonly Facility[], FetchError>> {
	if (signal?.aborted) {
		return Err({ type: 'aborted', message: 'Request was cancelled before it started' });
	}

	const timeout = timeoutSignal(REQUEST_TIMEOUT_MS);
	const combinedSignal = linkSignals(timeout.signal, signal);

	try {
		const first = await requestOnce(query, bounds, combinedSignal);
		if (isErr(first) && first.error.type === 'busy') {
			await delay(retryDelayMs(first.error.retryAfterMs), combinedSignal);
			return await requestOnce(query, bounds, combinedSignal);
		}
		return first;
	} catch (error) {
		return Err(toFetchError(error, timeout.timedOut()));
	} finally {
		timeout.clear();
	}
}
