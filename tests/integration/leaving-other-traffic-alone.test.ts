import { describe, expect, it } from 'vitest';
import { startWorker } from '../offline-harness';

describe('Leaving other traffic alone', () => {
	it('leaves Overpass, analytics, health checks, unknown hosts and malformed tile paths untouched', async () => {
		const worker = startWorker();

		const overpassPost = await worker.request(
			new Request('https://overpass-api.de/api/interpreter', { method: 'POST' })
		);
		const umamiScript = await worker.request('https://analytics.gribudzert.test/umami.js');
		const health = await worker.request('https://gribudzert.test/health');
		const unknownHostImage = await worker.request('https://example.com/photo.png');
		const nonPngTilePath = await worker.request('https://tile.openstreetmap.org/13/1/1.jpg');
		const outOfRangeTile = await worker.request('https://tile.openstreetmap.org/1/99/99.png');

		expect(overpassPost).toBeNull();
		expect(umamiScript).toBeNull();
		expect(health).toBeNull();
		expect(unknownHostImage).toBeNull();
		expect(nonPngTilePath).toBeNull();
		expect(outOfRangeTile).toBeNull();

		expect(worker.tileFetches).toHaveLength(0);
		expect(worker.shellFetches).toHaveLength(0);
		expect(await worker.tiles.meta()).toHaveLength(0);
	});
});
