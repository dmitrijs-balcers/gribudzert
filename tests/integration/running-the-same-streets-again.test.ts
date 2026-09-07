import { describe, expect, it } from 'vitest';
import { pngBytes, startWorker, tileUrl } from '../offline-harness';

const assertResponded = (response: Response | null): Response => {
	if (response === null) {
		throw new Error('Expected a response, got passthrough');
	}
	return response;
};

describe('Running the same streets again', () => {
	it('fetches an unseen tile from the network once and tags the response as coming from the network', async () => {
		const worker = startWorker();

		const response = assertResponded(await worker.request(tileUrl(13, 100, 200)));

		expect(response.status).toBe(200);
		expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('network');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(pngBytes(0, 8192)));
		expect(worker.tileFetches).toEqual([tileUrl(13, 100, 200)]);
	});

	it('serves the same tile again from cache without another upstream fetch', async () => {
		const worker = startWorker();
		await worker.request(tileUrl(13, 100, 200));
		await worker.settle();

		const response = assertResponded(await worker.request(tileUrl(13, 100, 200)));

		expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('cache');
		expect(worker.tileFetches).toEqual([tileUrl(13, 100, 200)]);
	});

	it('fetches one tile just once even when two requests for it arrive together', async () => {
		const worker = startWorker();
		worker.replyToTiles(async () => {
			await new Promise((resolve) => setTimeout(resolve, 20));
			return {};
		});

		const [first, second] = await Promise.all([
			worker.request(tileUrl(13, 1, 1)),
			worker.request(tileUrl(13, 1, 1)),
		]);

		expect(assertResponded(first).status).toBe(200);
		expect(assertResponded(second).status).toBe(200);
		expect(worker.tileFetches).toEqual([tileUrl(13, 1, 1)]);
	});

	it('fetches only the tiles the map actually asked for', async () => {
		const worker = startWorker();

		await worker.request(tileUrl(13, 1, 1));
		await worker.request(tileUrl(13, 2, 2));
		await worker.request(tileUrl(13, 3, 3));

		expect(worker.tileFetches).toEqual([tileUrl(13, 1, 1), tileUrl(13, 2, 2), tileUrl(13, 3, 3)]);
	});

	it('fetches a tile with the original request, never bypassing the cache', async () => {
		const worker = startWorker();

		await worker.request(tileUrl(13, 5, 5));

		expect(worker.tileFetches).toEqual([tileUrl(13, 5, 5)]);
		expect(worker.tileFetchCacheModes[0]).not.toBe('no-cache');
	});
});
