import { CHEVRON_DOWN_ICON, CLOSE_ICON, DIRECTIONS_ICON, MAP_ICON } from './icons';
import {
	CLOSE_LABEL,
	COLLAPSE_LABEL,
	DETAIL_SHEET_CLASS,
	DETAIL_SHEET_TITLE_ID,
	DETAILS_LABEL,
	DIRECTIONS_LABEL,
	NEAREST_TAG,
	OSM_LINK_LABEL,
	PHOTO_CREDIT,
	PROVENANCE,
} from './labels';

const EXTERNAL_REL = 'noopener noreferrer';

export const element = <K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className: string,
	attributes: Readonly<Record<string, string>> = {}
): HTMLElementTagNameMap[K] => {
	const created = document.createElement(tag);
	created.className = className;
	for (const [name, value] of Object.entries(attributes)) {
		created.setAttribute(name, value);
	}
	return created;
};

export const iconSpan = (className: string, markup: string): HTMLSpanElement => {
	const span = element('span', className, { 'aria-hidden': 'true' });
	span.innerHTML = markup;
	return span;
};

export const iconButton = (className: string, label: string, markup: string): HTMLButtonElement => {
	const button = element('button', className, { type: 'button', 'aria-label': label });
	button.appendChild(iconSpan('detail-sheet-button-icon', markup));
	return button;
};

export const externalAnchor = (className: string): HTMLAnchorElement =>
	element('a', className, { target: '_blank', rel: EXTERNAL_REL });

const labelledSpan = (text: string): HTMLSpanElement => {
	const span = element('span', 'detail-sheet-button-label');
	span.textContent = text;
	return span;
};

const lazyImage = (className: string): HTMLImageElement =>
	element('img', className, { alt: '', loading: 'lazy', decoding: 'async' });

export type HeroElements = {
	readonly root: HTMLElement;
	readonly link: HTMLAnchorElement;
	readonly image: HTMLImageElement;
	readonly credit: HTMLAnchorElement;
};

const createHero = (): HeroElements => {
	const root = element('figure', 'detail-sheet-hero');
	const link = externalAnchor('detail-sheet-hero-link');
	const image = lazyImage('detail-sheet-hero-image');
	link.appendChild(image);
	const credit = externalAnchor('detail-sheet-credit');
	credit.textContent = PHOTO_CREDIT;
	root.append(link, credit);
	return { root, link, image, credit };
};

export type ThumbElements = {
	readonly root: HTMLAnchorElement;
	readonly image: HTMLImageElement;
};

const createThumb = (): ThumbElements => {
	const root = externalAnchor('detail-sheet-thumb');
	const image = lazyImage('detail-sheet-thumb-image');
	root.appendChild(image);
	return { root, image };
};

export type SheetElements = {
	readonly root: HTMLElement;
	readonly hero: HeroElements;
	readonly kindIcon: HTMLSpanElement;
	readonly kindLabel: HTMLSpanElement;
	readonly nearestTag: HTMLSpanElement;
	readonly collapse: HTMLButtonElement;
	readonly close: HTMLButtonElement;
	readonly title: HTMLHeadingElement;
	readonly live: HTMLElement;
	readonly thumb: ThumbElements;
	readonly directions: HTMLAnchorElement;
	readonly osm: HTMLAnchorElement;
	readonly details: HTMLButtonElement;
	readonly detailsLabel: HTMLSpanElement;
	readonly more: HTMLElement;
	readonly warnings: HTMLElement;
	readonly description: HTMLParagraphElement;
	readonly facts: HTMLUListElement;
	readonly links: HTMLElement;
	readonly identity: HTMLSpanElement;
};

type ActionElements = Pick<SheetElements, 'directions' | 'osm' | 'details' | 'detailsLabel'> & {
	readonly root: HTMLElement;
};

const createActions = (): ActionElements => {
	const root = element('div', 'detail-sheet-actions');

	const directions = externalAnchor('detail-sheet-directions');
	directions.append(
		iconSpan('detail-sheet-button-icon', DIRECTIONS_ICON),
		labelledSpan(DIRECTIONS_LABEL)
	);

	const secondary = element('div', 'detail-sheet-secondary-row');
	const osm = externalAnchor('detail-sheet-osm');
	osm.append(iconSpan('detail-sheet-button-icon', MAP_ICON), labelledSpan(OSM_LINK_LABEL));

	const details = element('button', 'detail-sheet-details', {
		type: 'button',
		'aria-expanded': 'false',
	});
	const detailsLabel = labelledSpan(DETAILS_LABEL);
	details.append(detailsLabel, iconSpan('detail-sheet-button-icon', CHEVRON_DOWN_ICON));

	secondary.append(osm, details);
	root.append(directions, secondary);
	return { root, directions, osm, details, detailsLabel };
};

type FooterElements = { readonly root: HTMLElement; readonly identity: HTMLSpanElement };

const createFooter = (): FooterElements => {
	const root = element('footer', 'detail-sheet-footer');
	const provenance = element('span', 'detail-sheet-provenance');
	provenance.textContent = PROVENANCE;
	const identity = element('span', 'detail-sheet-identity');
	root.append(provenance, identity);
	return { root, identity };
};

export const createElements = (): SheetElements => {
	const root = element('section', DETAIL_SHEET_CLASS, {
		role: 'dialog',
		'aria-labelledby': DETAIL_SHEET_TITLE_ID,
	});
	root.hidden = true;

	const hero = createHero();

	const head = element('div', 'detail-sheet-head');
	const kind = element('div', 'detail-sheet-kind');
	const kindIcon = iconSpan('detail-sheet-kind-icon', '');
	const kindLabel = element('span', 'detail-sheet-kind-label');
	const nearestTag = element('span', 'detail-sheet-nearest');
	nearestTag.textContent = NEAREST_TAG;
	kind.append(kindIcon, kindLabel, nearestTag);
	const collapse = iconButton('detail-sheet-collapse', COLLAPSE_LABEL, CHEVRON_DOWN_ICON);
	const close = iconButton('detail-sheet-close', CLOSE_LABEL, CLOSE_ICON);
	head.append(collapse, kind, close);

	const summary = element('div', 'detail-sheet-summary');
	const titles = element('div', 'detail-sheet-titles');
	const title = element('h2', 'detail-sheet-title', { id: DETAIL_SHEET_TITLE_ID, tabindex: '-1' });
	const live = element('p', 'detail-sheet-live', { 'aria-live': 'polite' });
	titles.append(title, live);
	const thumb = createThumb();
	summary.append(titles, thumb.root);

	const actions = createActions();

	const more = element('div', 'detail-sheet-more');
	const warnings = element('div', 'detail-sheet-warnings');
	const description = element('p', 'detail-sheet-description');
	const facts = element('ul', 'detail-sheet-facts');
	const links = element('div', 'detail-sheet-links');
	const footer = createFooter();
	more.append(warnings, description, facts, links, footer.root);

	const body = element('div', 'detail-sheet-body');
	body.append(head, summary, actions.root, more);
	root.append(hero.root, body);

	return {
		root,
		hero,
		kindIcon,
		kindLabel,
		nearestTag,
		collapse,
		close,
		title,
		live,
		thumb,
		directions: actions.directions,
		osm: actions.osm,
		details: actions.details,
		detailsLabel: actions.detailsLabel,
		more,
		warnings,
		description,
		facts,
		links,
		identity: footer.identity,
	};
};
