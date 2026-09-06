/**
 * Facility cache IndexedDB boundary
 * Persists a single `Snapshot` record. The app must never break because storage is
 * unavailable or misbehaving (private browsing throwing on open, a blocked upgrade, a quota
 * error, ...): every failure is caught and logged here, `load` resolves `null` and `save`
 * simply resolves, so a caller never needs to handle a storage failure explicitly.
 */

import { FACILITY_CACHE_DB_NAME, FACILITY_CACHE_SCHEMA_VERSION } from '../../core/config';
import * as logger from '../../utils/logger';
import type { Snapshot } from './snapshot';
import { parseSnapshot } from './snapshot';

/**
 * Storage boundary for a `Snapshot`. Both operations are total: they never reject or throw.
 */
export type SnapshotStore = {
	/** The persisted snapshot, or null when absent, unreadable, or invalid */
	readonly load: () => Promise<Snapshot | null>;
	readonly save: (snapshot: Snapshot) => Promise<void>;
};

const OBJECT_STORE_NAME = 'cache';
const RECORD_KEY = 'snapshot';
const DB_VERSION = 1;

/**
 * Open (creating the object store on first use) the facility cache database
 */
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

/**
 * Read the raw record at `RECORD_KEY`, `undefined` when there is none
 */
const readRecord = (db: IDBDatabase): Promise<unknown> =>
	new Promise((resolve, reject) => {
		const request = db
			.transaction(OBJECT_STORE_NAME, 'readonly')
			.objectStore(OBJECT_STORE_NAME)
			.get(RECORD_KEY);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Failed to read facility cache'));
	});

/**
 * Write `snapshot` at `RECORD_KEY`, resolving once the transaction has committed
 */
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

/**
 * Real IndexedDB-backed store: database `dbName`, a single object store `cache`, the
 * snapshot kept under the fixed key `'snapshot'`.
 */
export const indexedDbSnapshotStore = (dbName: string = FACILITY_CACHE_DB_NAME): SnapshotStore => ({
	load: async () => {
		try {
			const db = await openDatabase(dbName);
			try {
				const raw = await readRecord(db);
				return raw === undefined ? null : parseSnapshot(raw, FACILITY_CACHE_SCHEMA_VERSION);
			} finally {
				db.close();
			}
		} catch (error) {
			logger.error('Facility cache load failed', error);
			return null;
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

/**
 * In-memory store for environments without IndexedDB. Data lives only for the lifetime of
 * the store value - nothing survives a reload.
 */
export const memorySnapshotStore = (): SnapshotStore => {
	let stored: Snapshot | null = null;
	return {
		load: async () => stored,
		save: async (snapshot) => {
			stored = snapshot;
		},
	};
};

/**
 * IndexedDB-backed store when `indexedDB` exists, otherwise an in-memory fallback
 */
export const defaultSnapshotStore = (): SnapshotStore =>
	typeof indexedDB === 'undefined' ? memorySnapshotStore() : indexedDbSnapshotStore();
