/**
 * Overpass query composition
 * Each facility layer owns a selector fragment (the `nwr[...]([bbox]);` statements for its
 * kind); this module is the only place that wraps fragments in the shared query
 * header/footer. Composing every active layer's selector into one query lets a viewport
 * refresh make a single Overpass request no matter how many layers are on, which matters
 * because the public Overpass API only grants 2 concurrent request slots per IP.
 */

/**
 * Branded Overpass QL selector fragment for one facility kind: one or more
 * `nwr["tag"="value"]([bbox]);` statements, optionally preceded by a comment. Never a full
 * program - it carries no `[out:json]` header and no `out center;` footer, so composing
 * several of them can't accidentally repeat either.
 */
export type OverpassSelector = string & { readonly __brand: 'OverpassSelector' };

/**
 * Validate and brand a raw `.overpassql?raw` import as a selector fragment.
 * @throws if the fragment has no `[bbox]` placeholder to fill in, or if it carries the
 * query header/footer that `composeQuery` is responsible for adding
 */
export const overpassSelector = (raw: string): OverpassSelector => {
	const trimmed = raw.trim();
	if (!trimmed.includes('[bbox]')) {
		throw new Error('Overpass selector is missing a [bbox] placeholder');
	}
	if (/\[out:json\]|out\s+(center|body|skel)\s*;/.test(trimmed)) {
		throw new Error('Overpass selector must not include the query header or footer');
	}
	return trimmed as OverpassSelector;
};

/**
 * Compose one Overpass QL program from the selector fragments of every layer being
 * refreshed, wrapping their union in the single shared header/footer.
 * @param selectors - Selector fragments to union into one query
 */
export const composeQuery = (selectors: readonly OverpassSelector[]): string =>
	`[out:json][timeout:25];\n(\n${selectors.join('\n')}\n);\nout center;`;
