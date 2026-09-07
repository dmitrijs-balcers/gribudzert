import { describe, expect, it } from 'vitest';
import { TILE_CACHE_DB_NAME, TILE_CACHE_SCHEMA_VERSION } from '../../src/core/config';
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

const FAR_FUTURE_TIMESTAMP_MS = 4_102_444_800_000;

const writeRawTileRecord = (key: string, meta: unknown, bytes: unknown): Promise<void> =>
	new Promise((resolve, reject) => {
		const openRequest = indexedDB.open(TILE_CACHE_DB_NAME, 1);
		openRequest.onupgradeneeded = () => {
			const db = openRequest.result;
			if (!db.objectStoreNames.contains('meta')) {
				db.createObjectStore('meta');
			}
			if (!db.objectStoreNames.contains('bytes')) {
				db.createObjectStore('bytes');
			}
		};
		openRequest.onsuccess = () => {
			const db = openRequest.result;
			const transaction = db.transaction(['meta', 'bytes'], 'readwrite');
			transaction.objectStore('meta').put(meta, key);
			transaction.objectStore('bytes').put(bytes, key);
			transaction.oncomplete = () => {
				db.close();
				resolve();
			};
			transaction.onerror = () =>
				reject(transaction.error ?? new Error('Failed to write raw tile record'));
		};
		openRequest.onerror = () =>
			reject(openRequest.error ?? new Error('Failed to open tile cache database'));
	});

describe('Recovering from a corrupt tile record', () => {
	it('treats a tile record with the wrong schema version as a miss, and replaces it', async () => {
		const key = '13/100/100';
		await writeRawTileRecord(
			key,
			{
				version: 999,
				key,
				contentType: 'image/png',
				size: 8192,
				storedAt: 0,
				freshUntil: FAR_FUTURE_TIMESTAMP_MS,
				usableUntil: FAR_FUTURE_TIMESTAMP_MS,
				lastUsedAt: 0,
			},
			pngBytes(1, 8192)
		);

		const worker = startWorker();
		const response = assertResponded(await worker.request(tileUrl(13, 100, 100)));

		expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('network');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(pngBytes(0, 8192)));
		expect(worker.tileFetches).toEqual([tileUrl(13, 100, 100)]);

		await worker.settle();
		const stored = await worker.tiles.get(requireKey(13, 100, 100));
		expect(new Uint8Array(stored?.bytes ?? new ArrayBuffer(0))).toEqual(
			new Uint8Array(pngBytes(0, 8192))
		);
	});

	it('treats a tile record whose stored bytes do not match its declared size as a miss', async () => {
		const key = '13/101/101';
		await writeRawTileRecord(
			key,
			{
				version: TILE_CACHE_SCHEMA_VERSION,
				key,
				contentType: 'image/png',
				size: 8192,
				storedAt: 0,
				freshUntil: FAR_FUTURE_TIMESTAMP_MS,
				usableUntil: FAR_FUTURE_TIMESTAMP_MS,
				lastUsedAt: 0,
			},
			pngBytes(1, 100)
		);

		const worker = startWorker();
		const response = assertResponded(await worker.request(tileUrl(13, 101, 101)));

		expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('network');
		expect(worker.tileFetches).toEqual([tileUrl(13, 101, 101)]);
	});

	it('never lets a broken storage layer break a response; the tile still comes from the network', async () => {
		const worker = startWorker();
		const originalOpen = indexedDB.open.bind(indexedDB);
		indexedDB.open = (() => {
			throw new Error('indexedDB unavailable');
		}) as typeof indexedDB.open;

		try {
			const response = assertResponded(await worker.request(tileUrl(13, 102, 102)));

			expect(response.status).toBe(200);
			expect(response.headers.get('X-Gribudzert-Tile-Source')).toBe('network');
		} finally {
			indexedDB.open = originalOpen;
		}
	});
});
