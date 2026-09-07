import { describe, expect, it } from 'vitest';
import { mapTileKey } from '../../src/domain';
import { TILE_LIFETIME_FLOOR_MS } from '../../src/core/config';
import { startWorker, tileUrl } from '../offline-harness';

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
const ONE_SECOND_MS = 1_000;
const ONE_HOUR_MS = 60 * 60 * 1_000;
const SIXTY_ONE_SECONDS_MS = 61_000;
const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1_000;

describe('Honouring the tile server headers', () => {
	it('keeps a tile fresh for the whole max-age the tile server sent', async () => {
		const worker = startWorker();
		const tile = tileUrl(13, 30, 30);
		await worker.request(tile);
		await worker.settle();

		worker.clock.advance(OSM_MAX_AGE_MS - ONE_SECOND_MS);
		const response = assertResponded(await worker.request(tile));

		expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('cache');
		expect(worker.tileFetches).toEqual([tile]);
	});

	it('keeps a tile without any cache headers for a full 7 days before refetching', async () => {
		const worker = startWorker();
		const tile = tileUrl(13, 31, 31);
		worker.replyToTiles(() => ({ headers: { cacheControl: null, expires: null } }));
		await worker.request(tile);
		await worker.settle();

		worker.clock.advance(TILE_LIFETIME_FLOOR_MS - ONE_HOUR_MS);
		const response = assertResponded(await worker.request(tile));

		expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('cache');
		expect(worker.tileFetches).toEqual([tile]);
	});

	it('revalidates a tile whose max-age is shorter than the usual floor once it passes', async () => {
		const worker = startWorker();
		const tile = tileUrl(13, 32, 32);
		worker.replyToTiles(() => ({ headers: { cacheControl: 'max-age=60' } }));
		await worker.request(tile);
		await worker.settle();

		worker.clock.advance(SIXTY_ONE_SECONDS_MS);
		const response = assertResponded(await worker.request(tile));
		expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('cache');

		await worker.settle();

		expect(worker.tileFetches).toEqual([tile, tile]);
	});

	it('never uses a tile past its 30-day hard cap; the network is asked first', async () => {
		const worker = startWorker();
		const tile = tileUrl(13, 33, 33);
		await worker.request(tile);
		await worker.settle();

		worker.clock.advance(THIRTY_ONE_DAYS_MS);
		const response = assertResponded(await worker.request(tile));

		expect(worker.tileFetches).toEqual([tile, tile]);
		expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('network');
	});

	it('evicts a tile that has aged past its 30-day hard cap when the worker activates', async () => {
		const worker = startWorker();
		const tile = tileUrl(13, 34, 34);
		const key = requireKey(13, 34, 34);
		await worker.request(tile);
		await worker.settle();

		worker.clock.advance(THIRTY_ONE_DAYS_MS);
		await worker.activate();

		expect(await worker.tiles.get(key)).toBeNull();
	});
});
