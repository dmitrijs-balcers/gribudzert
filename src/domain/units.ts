export type Timestamp = number & { readonly __brand: 'Timestamp' };

export const timestamp = (value: number): Timestamp | null =>
	Number.isFinite(value) && value >= 0 ? (value as Timestamp) : null;

export const timestampNow = (): Timestamp => Date.now() as Timestamp;

export type DurationMs = number & { readonly __brand: 'DurationMs' };

export const durationMs = (value: number): DurationMs | null =>
	Number.isFinite(value) && value >= 0 ? (value as DurationMs) : null;

type IsNumberLiteral<N extends number> = number extends N ? false : true;

type IsNonNegativeIntegerLiteral<N extends number> = `${N}` extends
	| `-${string}`
	| `${string}.${string}`
	? false
	: true;

type NonNegativeIntegerLiteral<N extends number> = IsNumberLiteral<N> extends true
	? IsNonNegativeIntegerLiteral<N> extends true
		? N
		: never
	: never;

export const durationMsLiteral = <N extends number>(
	value: NonNegativeIntegerLiteral<N>
): DurationMs => value as unknown as DurationMs;

export type ZoomLevelLiteral =
	| 0
	| 1
	| 2
	| 3
	| 4
	| 5
	| 6
	| 7
	| 8
	| 9
	| 10
	| 11
	| 12
	| 13
	| 14
	| 15
	| 16
	| 17
	| 18
	| 19
	| 20
	| 21
	| 22;

export type Zoom = number & { readonly __brand: 'Zoom' };

export const zoom = (value: number): Zoom | null =>
	Number.isInteger(value) && value >= 0 && value <= 22 ? (value as Zoom) : null;

export const zoomLevel = <Z extends ZoomLevelLiteral>(value: Z): Zoom => value as Zoom;

type PositiveIntegerLiteral<N extends number> = IsNumberLiteral<N> extends true
	? N extends 0
		? never
		: IsNonNegativeIntegerLiteral<N> extends true
			? N
			: never
	: never;

export type SchemaVersion = number & { readonly __brand: 'SchemaVersion' };

export const schemaVersionLiteral = <N extends number>(
	value: PositiveIntegerLiteral<N>
): SchemaVersion => value as unknown as SchemaVersion;

export const entriesOf = <K extends string, V>(
	record: Readonly<Record<K, V>>
): readonly (readonly [K, V])[] =>
	Object.entries(record) as unknown as readonly (readonly [K, V])[];

export const keysOf = <K extends string>(record: Readonly<Record<K, unknown>>): readonly K[] =>
	Object.keys(record) as unknown as readonly K[];
