import { describe, expect, it } from 'vitest';
import {
	commonsOf,
	imageOf,
	mediaFromTags,
	websiteLinkOf,
	wikidataLinkOf,
	wikipediaLinkOf,
} from '../../src/domain';

describe('Linking to Wikipedia', () => {
	it('builds an article link from a lang:Title tag, encoding spaces and diacritics', () => {
		expect(wikipediaLinkOf('lv:Katedrāles kalns')).toEqual({
			kind: 'wikipedia',
			url: 'https://lv.wikipedia.org/wiki/Katedr%C4%81les_kalns',
			label: 'Wikipedia',
		});
	});

	it('accepts hyphenated language codes', () => {
		expect(wikipediaLinkOf('zh-yue:Foo')?.url).toBe('https://zh-yue.wikipedia.org/wiki/Foo');
	});

	it('rejects values without a language prefix or with an empty title', () => {
		expect(wikipediaLinkOf('Cathedral Hill')).toBeNull();
		expect(wikipediaLinkOf('https://en.wikipedia.org/wiki/Foo')).toBeNull();
		expect(wikipediaLinkOf('en: ')).toBeNull();
		expect(wikipediaLinkOf(undefined)).toBeNull();
	});
});

describe('Linking to Wikidata', () => {
	it('builds an item link from a Q identifier', () => {
		expect(wikidataLinkOf('Q42')).toEqual({
			kind: 'wikidata',
			url: 'https://www.wikidata.org/wiki/Q42',
			label: 'Wikidata',
		});
	});

	it('rejects anything that is not a single Q identifier', () => {
		expect(wikidataLinkOf('42')).toBeNull();
		expect(wikidataLinkOf('Q42;Q43')).toBeNull();
		expect(wikidataLinkOf(undefined)).toBeNull();
	});
});

describe('Linking to a website', () => {
	it('prefers website over contact:website over url', () => {
		expect(
			websiteLinkOf({
				website: 'https://www.example.org/hill',
				'contact:website': 'https://contact.example.org',
				url: 'https://url.example.org',
			})?.url
		).toBe('https://www.example.org/hill');
		expect(
			websiteLinkOf({ 'contact:website': 'https://contact.example.org', url: 'https://u.org' })?.url
		).toBe('https://contact.example.org/');
		expect(websiteLinkOf({ url: 'http://u.example.org/x' })?.url).toBe('http://u.example.org/x');
	});

	it('labels the link with the hostname without www.', () => {
		expect(websiteLinkOf({ website: 'https://www.example.org/hill' })?.label).toBe('example.org');
		expect(websiteLinkOf({ website: 'https://maps.example.org' })?.label).toBe('maps.example.org');
	});

	it('ignores values that are not http(s) URLs', () => {
		expect(websiteLinkOf({ website: 'example.org' })).toBeNull();
		expect(websiteLinkOf({ website: 'ftp://example.org' })).toBeNull();
		expect(websiteLinkOf({ website: 'javascript:alert(1)' })).toBeNull();
		expect(websiteLinkOf({})).toBeNull();
	});

	it('takes the first of a semicolon separated list', () => {
		expect(websiteLinkOf({ website: 'https://a.org; https://b.org' })?.url).toBe('https://a.org/');
	});
});

describe('Reading wikimedia_commons', () => {
	it('turns a File: value into a photo with a 640px thumbnail and its page', () => {
		expect(commonsOf('File:Cathedral Hill.jpg')).toEqual({
			kind: 'photo',
			photo: {
				thumbnailUrl:
					'https://commons.wikimedia.org/wiki/Special:FilePath/Cathedral_Hill.jpg?width=640',
				pageUrl: 'https://commons.wikimedia.org/wiki/File:Cathedral_Hill.jpg',
			},
		});
	});

	it('turns a Category: value into a Commons link', () => {
		expect(commonsOf('Category:Cathedral Hill')).toEqual({
			kind: 'link',
			link: {
				kind: 'commons',
				url: 'https://commons.wikimedia.org/wiki/Category:Cathedral_Hill',
				label: 'Wikimedia Commons',
			},
		});
	});

	it('ignores anything else', () => {
		expect(commonsOf('Cathedral Hill.jpg')).toBeNull();
		expect(commonsOf('File:')).toBeNull();
		expect(commonsOf(undefined)).toBeNull();
	});
});

describe('Reading the image tag', () => {
	it('derives a Commons photo from a Commons file page URL', () => {
		expect(imageOf('https://commons.wikimedia.org/wiki/File:Cathedral%20Hill.jpg')).toEqual({
			kind: 'photo',
			photo: {
				thumbnailUrl:
					'https://commons.wikimedia.org/wiki/Special:FilePath/Cathedral_Hill.jpg?width=640',
				pageUrl: 'https://commons.wikimedia.org/wiki/File:Cathedral_Hill.jpg',
			},
		});
	});

	it('derives a Commons photo from an upload.wikimedia.org URL, thumbnails included', () => {
		const direct = imageOf('https://upload.wikimedia.org/wikipedia/commons/a/ab/Hill.jpg');
		const thumb = imageOf(
			'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Hill.jpg/320px-Hill.jpg'
		);
		expect(direct?.kind).toBe('photo');
		expect(thumb).toEqual(direct);
		expect(direct?.kind === 'photo' ? direct.photo.pageUrl : null).toBe(
			'https://commons.wikimedia.org/wiki/File:Hill.jpg'
		);
	});

	it('turns any other http(s) URL into a Photo link', () => {
		expect(imageOf('https://photos.example.org/hill.jpg')).toEqual({
			kind: 'link',
			link: { kind: 'photo', url: 'https://photos.example.org/hill.jpg', label: 'Photo' },
		});
	});

	it('ignores values that are not URLs', () => {
		expect(imageOf('hill.jpg')).toBeNull();
		expect(imageOf(undefined)).toBeNull();
	});
});

describe('Collecting media from tags', () => {
	it('orders links Wikipedia, website, Wikidata, Commons, photo and picks the Commons photo', () => {
		const media = mediaFromTags({
			image: 'https://photos.example.org/hill.jpg',
			wikimedia_commons: 'File:Hill.jpg',
			wikidata: 'Q42',
			wikipedia: 'en:Hill',
			website: 'https://www.example.org',
		});

		expect(media.links.map((link) => link.kind)).toEqual([
			'wikipedia',
			'website',
			'wikidata',
			'photo',
		]);
		expect(media.photo?.pageUrl).toBe('https://commons.wikimedia.org/wiki/File:Hill.jpg');
	});

	it('falls back to an image-derived Commons photo when wikimedia_commons is a category', () => {
		const media = mediaFromTags({
			wikimedia_commons: 'Category:Hill',
			image: 'https://commons.wikimedia.org/wiki/File:Hill.jpg',
		});

		expect(media.photo?.pageUrl).toBe('https://commons.wikimedia.org/wiki/File:Hill.jpg');
		expect(media.links.map((link) => link.kind)).toEqual(['commons']);
	});

	it('yields nothing for tags without media', () => {
		expect(mediaFromTags({ amenity: 'drinking_water' })).toEqual({ links: [], photo: null });
	});
});
