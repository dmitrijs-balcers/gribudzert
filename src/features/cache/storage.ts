import { FACILITY_CACHE_DB_NAME, FACILITY_CACHE_SCHEMA_VERSION } from '../../core/config';
import { isErr } from '../../types/result';
import * as logger from '../../utils/logger';
import type { Snapshot, SnapshotParseError } from './snapshot';
import { emptySnapshot, parseSnapshot } from './snapshot';

export type LoadedSnapshot =
	| { readonly kind: 'absent' }
	| { readonly kind: 'present'; readonly snapshot: Snapshot }
	| { readonly kind: 'corrupt'; readonly error: SnapshotParseError }
	| { readonly kind: 'unavailable'; readonly error: unknown };

export type SnapshotStore = {
	readonly load: () => Promise<LoadedSnapshot>;
	readonly save: (snapshot: Snapshot) => Promise<void>;
};

const OBJECT_STORE_NAME = 'cache';
const RECORD_KEY = 'snapshot';
const DB_VERSION = 1;

const openDatabase = (dbName: string): Promise<IDBDatabase> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
				db.createObjectStore(OBJECT_STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error('Failed to open facility cache database'));
		request.onblocked = () => reject(new Error('Facility cache database open was blocked'));
	});

const readRecord = (db: IDBDatabase): Promise<unknown> =>
	new Promise((resolve, reject) => {
		const request = db
			.transaction(OBJECT_STORE_NAME, 'readonly')
			.objectStore(OBJECT_STORE_NAME)
			.get(RECORD_KEY);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Failed to read facility cache'));
	});

const writeRecord = (db: IDBDatabase, snapshot: Snapshot): Promise<void> =>
	new Promise((resolve, reject) => {
		const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
		transaction.objectStore(OBJECT_STORE_NAME).put(snapshot, RECORD_KEY);
		transaction.oncomplete = () => resolve();
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('Failed to write facility cache'));
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('Facility cache write was aborted'));
	});

const describeSnapshotParseError = (error: SnapshotParseError): string => {
	switch (error.reason) {
		case 'not-a-record':
			return 'not a record';
		case 'version-mismatch':
			return `version mismatch (found ${JSON.stringify(error.found)})`;
		case 'invalid-tile-id':
			return `invalid tile id "${error.tileId}"`;
		case 'invalid-coverage':
			return `invalid coverage for tile "${error.tileId}"`;
		case 'invalid-facility':
			return `invalid facility "${error.facilityId}"`;
		default: {
			const exhaustive: never = error;
			throw new Error(`Unhandled snapshot parse error: ${JSON.stringify(exhaustive)}`);
		}
	}
};

export const indexedDbSnapshotStore = (dbName: string = FACILITY_CACHE_DB_NAME): SnapshotStore => ({
	load: async () => {
		try {
			const db = await openDatabase(dbName);
			try {
				const raw = await readRecord(db);
				if (raw === undefined) {
					return { kind: 'absent' };
				}
				const parsed = parseSnapshot(raw, FACILITY_CACHE_SCHEMA_VERSION);
				if (isErr(parsed)) {
					logger.error(
						`Facility cache load failed: ${describeSnapshotParseError(parsed.error)}`,
						parsed.error
					);
					return { kind: 'corrupt', error: parsed.error };
				}
				return { kind: 'present', snapshot: parsed.value };
			} finally {
				db.close();
			}
		} catch (error) {
			logger.error('Facility cache load failed', error);
			return { kind: 'unavailable', error };
		}
	},
	save: async (snapshot) => {
		try {
			const db = await openDatabase(dbName);
			try {
				await writeRecord(db, snapshot);
			} finally {
				db.close();
			}
		} catch (error) {
			logger.error('Facility cache save failed', error);
		}
	},
});

export const memorySnapshotStore = (): SnapshotStore => {
	let stored: Snapshot | null = null;
	return {
		load: async () =>
			stored === null ? { kind: 'absent' } : { kind: 'present', snapshot: stored },
		save: async (snapshot) => {
			stored = snapshot;
		},
	};
};

export const defaultSnapshotStore = (): SnapshotStore =>
	typeof indexedDB === 'undefined' ? memorySnapshotStore() : indexedDbSnapshotStore();

export const snapshotFrom = (loaded: LoadedSnapshot): Snapshot => {
	switch (loaded.kind) {
		case 'present':
			return loaded.snapshot;
		case 'absent':
		case 'corrupt':
		case 'unavailable':
			return emptySnapshot();
		default: {
			const exhaustive: never = loaded;
			throw new Error(`Unhandled snapshot load outcome: ${JSON.stringify(exhaustive)}`);
		}
	}
};
