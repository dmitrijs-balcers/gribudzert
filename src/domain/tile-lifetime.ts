import type { DurationMs, Timestamp } from './units';

export type CacheHeaders = {
	readonly cacheControl: string | null;
	readonly expires: string | null;
};

export type TileLifetime = { readonly freshUntil: Timestamp; readonly usableUntil: Timestamp };

export type LifetimeBounds = { readonly floorMs: DurationMs; readonly maxAgeMs: DurationMs };

const directiveValue = (cacheControl: string | null, directive: string): number | null => {
	if (cacheControl === null) {
		return null;
	}
	for (const part of cacheControl.split(',')) {
		const trimmed = part.trim();
		const equalsIndex = trimmed.indexOf('=');
		if (equalsIndex === -1) {
			continue;
		}
		const name = trimmed.slice(0, equalsIndex).trim().toLowerCase();
		const rawValue = trimmed.slice(equalsIndex + 1).trim();
		if (name !== directive || !/^\d+$/.test(rawValue)) {
			continue;
		}
		return Number(rawValue);
	}
	return null;
};

export const lifetimeFrom = (
	headers: CacheHeaders,
	storedAt: Timestamp,
	bounds: LifetimeBounds
): TileLifetime => {
	const maxAge = directiveValue(headers.cacheControl, 'max-age');
	const maxAgeFreshUntil = maxAge === null ? null : storedAt + maxAge * 1000;

	const expiresMs = headers.expires === null ? Number.NaN : Date.parse(headers.expires);
	const expiresFreshUntil = Number.isNaN(expiresMs) || expiresMs < storedAt ? null : expiresMs;

	const freshUntilBase = maxAgeFreshUntil ?? expiresFreshUntil ?? storedAt + bounds.floorMs;

	const staleWhileRevalidate = directiveValue(headers.cacheControl, 'stale-while-revalidate');
	const staleIfError = directiveValue(headers.cacheControl, 'stale-if-error');
	const staleWindowMs = Math.max(staleWhileRevalidate ?? 0, staleIfError ?? 0) * 1000;

	const usableUntilBase = Math.max(freshUntilBase + staleWindowMs, storedAt + bounds.floorMs);

	const hardCap = storedAt + bounds.maxAgeMs;
	const freshUntil = Math.min(freshUntilBase, hardCap);
	const usableUntil = Math.max(Math.min(usableUntilBase, hardCap), freshUntil);

	return {
		freshUntil: freshUntil as Timestamp,
		usableUntil: usableUntil as Timestamp,
	};
};

export type Freshness = 'fresh' | 'stale' | 'expired';

export const freshnessAt = (lifetime: TileLifetime, now: Timestamp): Freshness => {
	if (now <= lifetime.freshUntil) {
		return 'fresh';
	}
	if (now <= lifetime.usableUntil) {
		return 'stale';
	}
	return 'expired';
};
