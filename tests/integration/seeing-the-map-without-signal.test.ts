import { describe, expect, it } from 'vitest';
import { mapTileKey } from '../../src/domain';
import { pngBytes, startWorker, tileUrl } from '../offline-harness';

const assertResponded = (response: Response | null): Response => {
	if (response === null) {
		throw new Error('Expected a response, got passthrough');
	}
	return response;
};

const OSM_MAX_AGE_MS = 72_861_000;
const JUST_PAST_FRESH_UNTIL_MS = OSM_MAX_AGE_MS + 60_000;
const WELL_PAST_USABLE_UNTIL_MS = 8 * 24 * 60 * 60 * 1000;

describe('Seeing the map without signal', () => {
	it('serves a stale cached tile while offline without fetching anything', async () => {
		const worker = startWorker();
		const tile = tileUrl(13, 10, 10);
		await worker.request(tile);
		await worker.settle();

		worker.clock.advance(JUST_PAST_FRESH_UNTIL_MS);
		worker.goOffline();
		const response = assertResponded(await worker.request(tile));

		expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('cache');
		expect(worker.tileFetches).toEqual([tile]);
	});

	it('still serves an expired cached tile while offline without fetching anything', async () => {
		const worker = startWorker();
		const tile = tileUrl(13, 11, 11);
		await worker.request(tile);
		await worker.settle();

		worker.clock.advance(WELL_PAST_USABLE_UNTIL_MS);
		worker.goOffline();
		const response = assertResponded(await worker.request(tile));

		expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('cache');
		expect(worker.tileFetches).toEqual([tile]);
	});

	it('responds 504 for a tile it never saved while offline, and stores nothing', async () => {
		const worker = startWorker();
		const tile = tileUrl(13, 12, 12);
		worker.goOffline();
		worker.replyToTiles(() => 'network-error');

		const response = assertResponded(await worker.request(tile));

		expect(response.status).toBe(504);
		const key = mapTileKey(13, 12, 12);
		if (key === null) {
			throw new Error('Unexpected invalid map tile key');
		}
		expect(await worker.tiles.get(key)).toBeNull();
	});

	it('serves a stale tile immediately once back online and refreshes it in the background', async () => {
		const worker = startWorker();
		const tile = tileUrl(13, 13, 13);
		const key = mapTileKey(13, 13, 13);
		if (key === null) {
			throw new Error('Unexpected invalid map tile key');
		}
		await worker.request(tile);
		await worker.settle();

		worker.clock.advance(JUST_PAST_FRESH_UNTIL_MS);
		worker.replyToTiles(() => ({ bytes: pngBytes(9, 8192) }));
		const response = assertResponded(await worker.request(tile));

		expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('cache');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(pngBytes(0, 8192)));

		await worker.settle();

		const stored = await worker.tiles.get(key);
		expect(stored).not.toBeNull();
		expect(new Uint8Array(stored?.bytes ?? new ArrayBuffer(0))).toEqual(
			new Uint8Array(pngBytes(9, 8192))
		);
	});
});
