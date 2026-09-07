import type { MapTileKey, SchemaVersion, TileLifetime, Timestamp } from '../../domain';
import { parseMapTileKey, timestamp } from '../../domain';
import type { Result } from '../../types/result';
import { Err, isErr, Ok } from '../../types/result';

export type StoredTileMeta = {
	readonly key: MapTileKey;
	readonly contentType: string;
	readonly size: number;
	readonly storedAt: Timestamp;
	readonly lifetime: TileLifetime;
	readonly lastUsedAt: Timestamp;
};

export type StoredTile = StoredTileMeta & { readonly bytes: ArrayBuffer };

export type StoredTileParseError =
	| { readonly reason: 'not-a-record' }
	| { readonly reason: 'version-mismatch'; readonly found: unknown }
	| { readonly reason: 'invalid-field'; readonly field: string }
	| { readonly reason: 'size-mismatch'; readonly declared: number; readonly actual: number };

type UnknownRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonNegativeInteger = (value: unknown): value is number =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0;

const parsedTimestamp = (value: unknown): Timestamp | null =>
	typeof value === 'number' ? timestamp(value) : null;

export const parseStoredTileMeta = (
	meta: unknown,
	version: SchemaVersion
): Result<StoredTileMeta, StoredTileParseError> => {
	if (!isRecord(meta)) {
		return Err({ reason: 'not-a-record' });
	}
	if (meta.version !== version) {
		return Err({ reason: 'version-mismatch', found: meta.version });
	}
	if (typeof meta.key !== 'string' || parseMapTileKey(meta.key) === null) {
		return Err({ reason: 'invalid-field', field: 'key' });
	}
	if (typeof meta.contentType !== 'string' || meta.contentType.length === 0) {
		return Err({ reason: 'invalid-field', field: 'contentType' });
	}
	if (!isNonNegativeInteger(meta.size)) {
		return Err({ reason: 'invalid-field', field: 'size' });
	}
	const storedAt = parsedTimestamp(meta.storedAt);
	if (storedAt === null) {
		return Err({ reason: 'invalid-field', field: 'storedAt' });
	}
	const freshUntil = parsedTimestamp(meta.freshUntil);
	if (freshUntil === null) {
		return Err({ reason: 'invalid-field', field: 'freshUntil' });
	}
	const usableUntil = parsedTimestamp(meta.usableUntil);
	if (usableUntil === null) {
		return Err({ reason: 'invalid-field', field: 'usableUntil' });
	}
	if (freshUntil > usableUntil) {
		return Err({ reason: 'invalid-field', field: 'usableUntil' });
	}
	const lastUsedAt = parsedTimestamp(meta.lastUsedAt);
	if (lastUsedAt === null) {
		return Err({ reason: 'invalid-field', field: 'lastUsedAt' });
	}

	return Ok({
		key: meta.key as MapTileKey,
		contentType: meta.contentType,
		size: meta.size,
		storedAt,
		lifetime: { freshUntil, usableUntil },
		lastUsedAt,
	});
};

export const parseStoredTile = (
	meta: unknown,
	bytes: unknown,
	version: SchemaVersion
): Result<StoredTile, StoredTileParseError> => {
	const parsedMeta = parseStoredTileMeta(meta, version);
	if (isErr(parsedMeta)) {
		return parsedMeta;
	}
	if (!(bytes instanceof ArrayBuffer)) {
		return Err({ reason: 'invalid-field', field: 'bytes' });
	}
	if (bytes.byteLength !== parsedMeta.value.size) {
		return Err({
			reason: 'size-mismatch',
			declared: parsedMeta.value.size,
			actual: bytes.byteLength,
		});
	}
	return Ok({ ...parsedMeta.value, bytes });
};

export const storedTileMetaRecord = (meta: StoredTileMeta, version: SchemaVersion): unknown => ({
	version,
	key: meta.key,
	contentType: meta.contentType,
	size: meta.size,
	storedAt: meta.storedAt,
	freshUntil: meta.lifetime.freshUntil,
	usableUntil: meta.lifetime.usableUntil,
	lastUsedAt: meta.lastUsedAt,
});

export const storedTileRecord = (
	tile: StoredTile,
	version: SchemaVersion
): { readonly meta: unknown; readonly bytes: ArrayBuffer } => ({
	meta: storedTileMetaRecord(tile, version),
	bytes: tile.bytes,
});
