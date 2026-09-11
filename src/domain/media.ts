import type { ExternalLink, Photo } from './facility';
import type { OsmTags } from './osm';

export type FacilityMedia = {
	readonly links: readonly ExternalLink[];
	readonly photo: Photo | null;
};

export type CommonsMedia =
	| { readonly kind: 'photo'; readonly photo: Photo }
	| { readonly kind: 'link'; readonly link: ExternalLink };

const WIKIPEDIA_LABEL = 'Wikipedia';
const WIKIDATA_LABEL = 'Wikidata';
const COMMONS_LABEL = 'Wikimedia Commons';
const PHOTO_LABEL = 'Photo';

const COMMONS_HOST = 'commons.wikimedia.org';
const COMMONS_FILE_PREFIX = 'File:';
const COMMONS_CATEGORY_PREFIX = 'Category:';
const COMMONS_THUMBNAIL_WIDTH = 640;

const WIKIPEDIA_PATTERN = /^([a-z]{2,}(?:-[a-z]+)*):(.+)$/;
const WIKIDATA_PATTERN = /^Q\d+$/;

const WEBSITE_KEYS: readonly string[] = ['website', 'contact:website', 'url'];

const encodeTitle = (title: string): string => encodeURIComponent(title.trim().replace(/ /g, '_'));

const isHttpUrl = (value: string): boolean =>
	value.startsWith('http://') || value.startsWith('https://');

const parseUrl = (value: string): URL | null => {
	if (!isHttpUrl(value)) {
		return null;
	}
	try {
		return new URL(value);
	} catch {
		return null;
	}
};

const firstOfList = (value: string): string => value.split(';')[0]?.trim() ?? '';

export const wikipediaLinkOf = (value: string | undefined): ExternalLink | null => {
	if (value === undefined || isHttpUrl(value.trim())) {
		return null;
	}
	const match = WIKIPEDIA_PATTERN.exec(value.trim());
	if (match === null) {
		return null;
	}
	const [, lang, title] = match;
	if (lang === undefined || title === undefined || title.trim() === '') {
		return null;
	}
	return {
		kind: 'wikipedia',
		url: `https://${lang}.wikipedia.org/wiki/${encodeTitle(title)}`,
		label: WIKIPEDIA_LABEL,
	};
};

export const wikidataLinkOf = (value: string | undefined): ExternalLink | null => {
	if (value === undefined) {
		return null;
	}
	const id = value.trim();
	if (!WIKIDATA_PATTERN.test(id)) {
		return null;
	}
	return { kind: 'wikidata', url: `https://www.wikidata.org/wiki/${id}`, label: WIKIDATA_LABEL };
};

const hostLabelOf = (url: URL): string => url.hostname.replace(/^www\./, '');

const websiteLinkFrom = (value: string): ExternalLink | null => {
	const url = parseUrl(firstOfList(value));
	if (url === null) {
		return null;
	}
	return { kind: 'website', url: url.href, label: hostLabelOf(url) };
};

export const websiteLinkOf = (tags: OsmTags): ExternalLink | null => {
	for (const key of WEBSITE_KEYS) {
		const value = tags[key];
		if (value !== undefined) {
			return websiteLinkFrom(value);
		}
	}
	return null;
};

const commonsPhotoOf = (fileName: string): Photo | null => {
	const name = fileName.trim();
	if (name === '') {
		return null;
	}
	const encoded = encodeTitle(name);
	return {
		thumbnailUrl: `https://${COMMONS_HOST}/wiki/Special:FilePath/${encoded}?width=${COMMONS_THUMBNAIL_WIDTH}`,
		pageUrl: `https://${COMMONS_HOST}/wiki/${COMMONS_FILE_PREFIX}${encoded}`,
	};
};

const commonsCategoryLinkOf = (category: string): ExternalLink | null => {
	const name = category.trim();
	if (name === '') {
		return null;
	}
	return {
		kind: 'commons',
		url: `https://${COMMONS_HOST}/wiki/${COMMONS_CATEGORY_PREFIX}${encodeTitle(name)}`,
		label: COMMONS_LABEL,
	};
};

export const commonsOf = (value: string | undefined): CommonsMedia | null => {
	if (value === undefined) {
		return null;
	}
	const trimmed = value.trim();
	if (trimmed.startsWith(COMMONS_FILE_PREFIX)) {
		const photo = commonsPhotoOf(trimmed.slice(COMMONS_FILE_PREFIX.length));
		return photo === null ? null : { kind: 'photo', photo };
	}
	if (trimmed.startsWith(COMMONS_CATEGORY_PREFIX)) {
		const link = commonsCategoryLinkOf(trimmed.slice(COMMONS_CATEGORY_PREFIX.length));
		return link === null ? null : { kind: 'link', link };
	}
	return null;
};

const isCommonsHost = (url: URL): boolean =>
	url.hostname === COMMONS_HOST || url.hostname === 'commons.m.wikimedia.org';

const isUploadHost = (url: URL): boolean => url.hostname === 'upload.wikimedia.org';

const safeDecode = (segment: string): string => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
};

const commonsFileNameFromPage = (url: URL): string | null => {
	const marker = `/wiki/${COMMONS_FILE_PREFIX}`;
	const index = url.pathname.indexOf(marker);
	if (index === -1) {
		return null;
	}
	const name = safeDecode(url.pathname.slice(index + marker.length));
	return name === '' ? null : name;
};

const commonsFileNameFromUpload = (url: URL): string | null => {
	const segments = url.pathname.split('/').filter((segment) => segment !== '');
	const commonsIndex = segments.indexOf('commons');
	if (commonsIndex === -1) {
		return null;
	}
	const rest = segments.slice(commonsIndex + 1);
	const name = rest[0] === 'thumb' ? rest[3] : rest[2];
	return name === undefined ? null : safeDecode(name);
};

const commonsFileNameOf = (url: URL): string | null => {
	if (isCommonsHost(url)) {
		return commonsFileNameFromPage(url);
	}
	if (isUploadHost(url)) {
		return commonsFileNameFromUpload(url);
	}
	return null;
};

export const imageOf = (value: string | undefined): CommonsMedia | null => {
	if (value === undefined) {
		return null;
	}
	const url = parseUrl(firstOfList(value));
	if (url === null) {
		return null;
	}
	const fileName = commonsFileNameOf(url);
	if (fileName !== null) {
		const photo = commonsPhotoOf(fileName);
		return photo === null ? null : { kind: 'photo', photo };
	}
	return { kind: 'link', link: { kind: 'photo', url: url.href, label: PHOTO_LABEL } };
};

const linkOf = (media: CommonsMedia | null): ExternalLink | null =>
	media !== null && media.kind === 'link' ? media.link : null;

const photoOf = (media: CommonsMedia | null): Photo | null =>
	media !== null && media.kind === 'photo' ? media.photo : null;

const isLink = (link: ExternalLink | null): link is ExternalLink => link !== null;

export const mediaFromTags = (tags: OsmTags): FacilityMedia => {
	const commons = commonsOf(tags.wikimedia_commons);
	const image = imageOf(tags.image);
	return {
		links: [
			wikipediaLinkOf(tags.wikipedia),
			websiteLinkOf(tags),
			wikidataLinkOf(tags.wikidata),
			linkOf(commons),
			linkOf(image),
		].filter(isLink),
		photo: photoOf(commons) ?? photoOf(image),
	};
};
