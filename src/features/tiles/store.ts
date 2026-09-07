import { TILE_CACHE_DB_NAME, TILE_CACHE_SCHEMA_VERSION } from '../../core/config';
import type { MapTileKey, Timestamp } from '../../domain';
import { isErr } from '../../types/result';
import * as logger from '../../utils/logger';
import type { StoredTile, StoredTileMeta } from './record';
import {
	parseStoredTile,
	parseStoredTileMeta,
	storedTileMetaRecord,
	storedTileRecord,
} from './record';

export type TileStore = {
	readonly get: (key: MapTileKey) => Promise<StoredTile | null>;
	readonly put: (tile: StoredTile) => Promise<void>;
	readonly touch: (key: MapTileKey, lastUsedAt: Timestamp) => Promise<void>;
	readonly meta: () => Promise<readonly StoredTileMeta[]>;
	readonly drop: (keys: readonly MapTileKey[]) => Promise<void>;
};

const META_STORE_NAME = 'meta';
const BYTES_STORE_NAME = 'bytes';
const DB_VERSION = 1;

const openDatabase = (dbName: string): Promise<IDBDatabase> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(META_STORE_NAME)) {
				db.createObjectStore(META_STORE_NAME);
			}
			if (!db.objectStoreNames.contains(BYTES_STORE_NAME)) {
				db.createObjectStore(BYTES_STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error('Failed to open tile cache database'));
		request.onblocked = () => reject(new Error('Tile cache database open was blocked'));
	});

const requestAsPromise = <T>(request: IDBRequest<T>): Promise<T> =>
	new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Tile cache request failed'));
	});

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
	new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('Tile cache transaction failed'));
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('Tile cache transaction aborted'));
	});

const deleteKeys = (db: IDBDatabase, keys: readonly MapTileKey[]): Promise<void> => {
	const transaction = db.transaction([META_STORE_NAME, BYTES_STORE_NAME], 'readwrite');
	const metaStore = transaction.objectStore(META_STORE_NAME);
	const bytesStore = transaction.objectStore(BYTES_STORE_NAME);
	for (const key of keys) {
		metaStore.delete(key);
		bytesStore.delete(key);
	}
	return transactionDone(transaction);
};

const getTile = async (db: IDBDatabase, key: MapTileKey): Promise<StoredTile | null> => {
	const transaction = db.transaction([META_STORE_NAME, BYTES_STORE_NAME], 'readonly');
	const metaRequest = transaction.objectStore(META_STORE_NAME).get(key);
	const bytesRequest = transaction.objectStore(BYTES_STORE_NAME).get(key);
	const [meta, bytes] = await Promise.all([
		requestAsPromise(metaRequest),
		requestAsPromise(bytesRequest),
	]);
	if (meta === undefined) {
		return null;
	}
	const parsed = parseStoredTile(meta, bytes, TILE_CACHE_SCHEMA_VERSION);
	if (isErr(parsed)) {
		logger.error('Tile cache record parse failed', parsed.error);
		await deleteKeys(db, [key]);
		return null;
	}
	return parsed.value;
};

const getAllMeta = async (db: IDBDatabase): Promise<readonly StoredTileMeta[]> => {
	const transaction = db.transaction(META_STORE_NAME, 'readonly');
	const store = transaction.objectStore(META_STORE_NAME);
	const keysRequest = store.getAllKeys();
	const valuesRequest = store.getAll();
	const [keys, values] = await Promise.all([
		requestAsPromise(keysRequest),
		requestAsPromise(valuesRequest),
	]);

	const validEntries: StoredTileMeta[] = [];
	const invalidKeys: MapTileKey[] = [];

	for (let index = 0; index < values.length; index += 1) {
		const value = values[index];
		const key = keys[index];
		if (value === undefined || key === undefined) {
			continue;
		}
		const parsed = parseStoredTileMeta(value, TILE_CACHE_SCHEMA_VERSION);
		if (isErr(parsed)) {
			logger.error('Tile cache meta record invalid', parsed.error);
			if (typeof key === 'string') {
				invalidKeys.push(key as MapTileKey);
			}
			continue;
		}
		validEntries.push(parsed.value);
	}

	if (invalidKeys.length > 0) {
		await deleteKeys(db, invalidKeys);
	}

	return validEntries;
};

const putTile = (db: IDBDatabase, tile: StoredTile): Promise<void> => {
	const { meta, bytes } = storedTileRecord(tile, TILE_CACHE_SCHEMA_VERSION);
	const transaction = db.transaction([META_STORE_NAME, BYTES_STORE_NAME], 'readwrite');
	transaction.objectStore(META_STORE_NAME).put(meta, tile.key);
	transaction.objectStore(BYTES_STORE_NAME).put(bytes, tile.key);
	return transactionDone(transaction);
};

const touchTile = async (
	db: IDBDatabase,
	key: MapTileKey,
	lastUsedAt: Timestamp
): Promise<void> => {
	const readTransaction = db.transaction(META_STORE_NAME, 'readonly');
	const raw = await requestAsPromise(readTransaction.objectStore(META_STORE_NAME).get(key));
	const parsed = parseStoredTileMeta(raw, TILE_CACHE_SCHEMA_VERSION);
	if (isErr(parsed)) {
		return;
	}
	const writeTransaction = db.transaction(META_STORE_NAME, 'readwrite');
	writeTransaction
		.objectStore(META_STORE_NAME)
		.put(storedTileMetaRecord({ ...parsed.value, lastUsedAt }, TILE_CACHE_SCHEMA_VERSION), key);
	await transactionDone(writeTransaction);
};

const withDatabase = async <T>(
	dbName: string,
	fallback: T,
	operationLabel: string,
	operation: (db: IDBDatabase) => Promise<T>
): Promise<T> => {
	try {
		const db = await openDatabase(dbName);
		try {
			return await operation(db);
		} finally {
			db.close();
		}
	} catch (error) {
		logger.error(`Tile cache ${operationLabel} failed`, error);
		return fallback;
	}
};

export const indexedDbTileStore = (dbName: string = TILE_CACHE_DB_NAME): TileStore => ({
	get: (key) => withDatabase(dbName, null, 'get', (db) => getTile(db, key)),
	put: (tile) => withDatabase(dbName, undefined, 'put', (db) => putTile(db, tile)),
	touch: (key, lastUsedAt) =>
		withDatabase(dbName, undefined, 'touch', (db) => touchTile(db, key, lastUsedAt)),
	meta: () => withDatabase(dbName, [], 'meta read', (db) => getAllMeta(db)),
	drop: (keys) => {
		if (keys.length === 0) {
			return Promise.resolve();
		}
		return withDatabase(dbName, undefined, 'drop', (db) => deleteKeys(db, keys));
	},
});

export const memoryTileStore = (): TileStore => {
	const store = new Map<MapTileKey, StoredTile>();
	return {
		get: async (key) => store.get(key) ?? null,
		put: async (tile) => {
			store.set(tile.key, tile);
		},
		touch: async (key, lastUsedAt) => {
			const existing = store.get(key);
			if (existing === undefined) {
				return;
			}
			store.set(key, { ...existing, lastUsedAt });
		},
		meta: async () =>
			[...store.values()].map((tile) => ({
				key: tile.key,
				contentType: tile.contentType,
				size: tile.size,
				storedAt: tile.storedAt,
				lifetime: tile.lifetime,
				lastUsedAt: tile.lastUsedAt,
			})),
		drop: async (keys) => {
			for (const key of keys) {
				store.delete(key);
			}
		},
	};
};
