import { describe, expect, it } from 'vitest';
import { mapTileKey } from '../../src/domain';
import { startWorker, tileUrl } from '../offline-harness';

const requireKey = (z: number, x: number, y: number) => {
	const key = mapTileKey(z, x, y);
	if (key === null) {
		throw new Error('Unexpected invalid map tile key');
	}
	return key;
};

const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1_000;

describe('Staying within the tile budget', () => {
	it('keeps only the 3 most recently used tiles when 5 distinct ones are requested', async () => {
		const worker = startWorker({
			budget: { maxTiles: 3, maxBytes: 1_000_000_000 },
			evictionEveryNPuts: 1,
		});
		const coordinates = [70, 71, 72, 73, 74];

		for (const x of coordinates) {
			worker.clock.advance(1_000);
			await worker.request(tileUrl(13, x, x));
			await worker.settle();
		}

		const meta = await worker.tiles.meta();
		const keptKeys = meta.map((entry) => entry.key).sort();
		const expectedKeys = [72, 73, 74].map((x) => requireKey(13, x, x)).sort();
		expect(keptKeys).toEqual(expectedKeys);
	});

	it('keeps only the newest tile when the byte budget is smaller than two tiles', async () => {
		const worker = startWorker({
			budget: { maxTiles: 100, maxBytes: 10_000 },
			evictionEveryNPuts: 1,
		});
		const first = tileUrl(13, 80, 80);
		const second = tileUrl(13, 81, 81);

		await worker.request(first);
		await worker.settle();
		worker.clock.advance(1_000);
		await worker.request(second);
		await worker.settle();

		const meta = await worker.tiles.meta();
		expect(meta).toHaveLength(1);
		expect(meta[0]?.key).toBe(requireKey(13, 81, 81));
	});

	it('drops an expired tile ahead of any fresh one, even if it was used most recently', async () => {
		const worker = startWorker({
			budget: { maxTiles: 3, maxBytes: 1_000_000_000 },
			evictionEveryNPuts: 1,
		});
		const staleTile = tileUrl(13, 90, 90);
		const staleKey = requireKey(13, 90, 90);
		await worker.request(staleTile);
		await worker.settle();

		worker.clock.advance(THIRTY_ONE_DAYS_MS);
		await worker.tiles.touch(staleKey, worker.clock.now());

		const freshTile = tileUrl(13, 91, 91);
		await worker.request(freshTile);
		await worker.settle();

		expect(await worker.tiles.get(staleKey)).toBeNull();
		expect(await worker.tiles.get(requireKey(13, 91, 91))).not.toBeNull();
	});

	it('enforces the tile budget when the worker activates', async () => {
		const worker = startWorker({
			budget: { maxTiles: 2, maxBytes: 1_000_000_000 },
			evictionEveryNPuts: 100,
		});
		await worker.request(tileUrl(13, 60, 60));
		await worker.settle();
		await worker.request(tileUrl(13, 61, 61));
		await worker.settle();
		await worker.request(tileUrl(13, 62, 62));
		await worker.settle();

		expect(await worker.tiles.meta()).toHaveLength(3);

		await worker.activate();

		expect(await worker.tiles.meta()).toHaveLength(2);
	});
});
