import { describe, expect, it } from 'vitest';
import { mapTileKey } from '../../src/domain';
import { pngBytes, startWorker, tileUrl } from '../offline-harness';

const assertResponded = (response: Response | null): Response => {
	if (response === null) {
		throw new Error('Expected a response, got passthrough');
	}
	return response;
};

const requireKey = (z: number, x: number, y: number) => {
	const key = mapTileKey(z, x, y);
	if (key === null) {
		throw new Error('Unexpected invalid map tile key');
	}
	return key;
};

const OSM_MAX_AGE_MS = 72_861_000;
const JUST_PAST_FRESH_UNTIL_MS = OSM_MAX_AGE_MS + 60_000;
const WELL_PAST_USABLE_UNTIL_MS = 8 * 24 * 60 * 60 * 1000;

describe('Keeping tiles fresh', () => {
	it('serves a tile past max-age from cache and refreshes it once in the background', async () => {
		const worker = startWorker();
		const tile = tileUrl(13, 20, 20);
		const key = requireKey(13, 20, 20);
		await worker.request(tile);
		await worker.settle();

		worker.clock.advance(JUST_PAST_FRESH_UNTIL_MS);
		worker.replyToTiles(() => ({ bytes: pngBytes(7, 8192) }));
		const response = assertResponded(await worker.request(tile));

		expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('cache');
		expect(worker.tileFetches).toEqual([tile, tile]);

		await worker.settle();

		const stored = await worker.tiles.get(key);
		expect(new Uint8Array(stored?.bytes ?? new ArrayBuffer(0))).toEqual(
			new Uint8Array(pngBytes(7, 8192))
		);
	});

	it('goes to the network first once expired, and falls back to the old tile on a network error', async () => {
		const worker = startWorker();
		const tile = tileUrl(13, 21, 21);
		await worker.request(tile);
		await worker.settle();

		worker.clock.advance(WELL_PAST_USABLE_UNTIL_MS);
		worker.replyToTiles(() => 'network-error');
		const response = assertResponded(await worker.request(tile));

		expect(worker.tileFetches).toEqual([tile, tile]);
		expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('cache');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(pngBytes(0, 8192)));
	});

	it('responds 404 for an unknown tile the upstream does not have, and stores nothing', async () => {
		const worker = startWorker();
		const tile = tileUrl(13, 22, 22);
		const key = requireKey(13, 22, 22);
		worker.replyToTiles(() => ({ status: 404 }));

		const response = assertResponded(await worker.request(tile));

		expect(response.status).toBe(404);
		expect(await worker.tiles.get(key)).toBeNull();
	});

	it('serves the fallback tile when refreshing an expired tile fails with a server error', async () => {
		const worker = startWorker();
		const tile = tileUrl(13, 23, 23);
		await worker.request(tile);
		await worker.settle();

		worker.clock.advance(WELL_PAST_USABLE_UNTIL_MS);
		worker.replyToTiles(() => ({ status: 500 }));
		const response = assertResponded(await worker.request(tile));

		expect(worker.tileFetches).toEqual([tile, tile]);
		expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('cache');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(pngBytes(0, 8192)));
	});

	it('passes an opaque upstream response through without storing it', async () => {
		const worker = startWorker();
		const tile = tileUrl(13, 24, 24);
		const key = requireKey(13, 24, 24);
		worker.replyToTiles(() => 'opaque');

		const response = assertResponded(await worker.request(tile));

		expect(response.type).toBe('opaque');
		expect(await worker.tiles.get(key)).toBeNull();
	});
});
