export type OverpassSelector = string & { readonly __brand: 'OverpassSelector' };

const QUERY_HEADER_OR_FOOTER = /\[out:json\]|out\s+(center|body|skel)\s*;/;

export const overpassSelector = (raw: string): OverpassSelector => {
	const trimmed = raw.trim();
	if (!trimmed.includes('[bbox]')) {
		throw new Error('Overpass selector is missing a [bbox] placeholder');
	}
	if (QUERY_HEADER_OR_FOOTER.test(trimmed)) {
		throw new Error('Overpass selector must not include the query header or footer');
	}
	return trimmed as OverpassSelector;
};

export type OverpassQuery = string & { readonly __brand: 'OverpassQuery' };

export const composeQuery = (selectors: readonly OverpassSelector[]): OverpassQuery =>
	`[out:json][timeout:25];\n(\n${selectors.join('\n')}\n);\nout center;` as OverpassQuery;
