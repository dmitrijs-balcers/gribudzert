import * as L from 'leaflet';
import type { Coordinates, ExternalLink, Photo } from '../../domain';
import { formatDistance } from '../../domain';
import type { DetailFact, DetailLive, DetailView, DetailWarning } from '../../features/detail';
import {
	CHEVRON_DOWN_ICON,
	CLOSE_ICON,
	DIRECTIONS_ICON,
	EXTERNAL_LINK_ICON,
	factIcon,
	kindIcon,
	MAP_ICON,
} from './icons';
import type { SheetEvent, SheetExpansion, SheetState } from './sheet-state';
import { applySheet, initialSheetState } from './sheet-state';
import './detail-sheet.css';

export type DetailSheetView =
	| { readonly kind: 'hidden' }
	| { readonly kind: 'shown'; readonly state: SheetExpansion; readonly detail: DetailView };

export type DetailSheetHandlers = {
	readonly onClose: () => void;
	readonly onDirections: (detail: DetailView) => void;
};

export type DetailSheet = {
	readonly render: (view: DetailSheetView) => void;
	readonly destroy: () => void;
};

export const DETAIL_SHEET_CLASS = 'detail-sheet';
export const DETAIL_SHEET_TITLE_ID = 'detail-sheet-title';
export const CLOSE_LABEL = 'Close';
export const DETAILS_LABEL = 'Details';
export const LESS_LABEL = 'Less';
export const COLLAPSE_LABEL = 'Show less';
export const DIRECTIONS_LABEL = 'Directions';
export const OSM_LINK_LABEL = 'OpenStreetMap';
export const NEAREST_TAG = 'Nearest water';
export const PHOTO_CREDIT = 'Wikimedia Commons';
export const PROVENANCE = 'Data © OpenStreetMap contributors';
export const SHEET_HEIGHT_PROPERTY = '--sheet-height';

const REVEAL_GAP_PX = 24;
const LIVE_COURSE_CLASS = 'detail-sheet-live--course';
const HISTORY_STATE_KEY = 'detailSheet';
const EXTERNAL_REL = 'noopener noreferrer';

const element = <K extends keyof HTMLElementTagNameMap>(
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

const iconSpan = (className: string, markup: string): HTMLSpanElement => {
	const span = element('span', className, { 'aria-hidden': 'true' });
	span.innerHTML = markup;
	return span;
};

const iconButton = (className: string, label: string, markup: string): HTMLButtonElement => {
	const button = element('button', className, { type: 'button', 'aria-label': label });
	button.appendChild(iconSpan('detail-sheet-button-icon', markup));
	return button;
};

const externalAnchor = (className: string): HTMLAnchorElement =>
	element('a', className, { target: '_blank', rel: EXTERNAL_REL });

type HeroElements = {
	readonly root: HTMLElement;
	readonly link: HTMLAnchorElement;
	readonly image: HTMLImageElement;
	readonly credit: HTMLAnchorElement;
};

const createHero = (): HeroElements => {
	const root = element('figure', 'detail-sheet-hero');
	const link = externalAnchor('detail-sheet-hero-link');
	const image = element('img', 'detail-sheet-hero-image', {
		alt: '',
		loading: 'lazy',
		decoding: 'async',
	});
	link.appendChild(image);
	const credit = externalAnchor('detail-sheet-credit');
	credit.textContent = PHOTO_CREDIT;
	root.append(link, credit);
	return { root, link, image, credit };
};

type ThumbElements = {
	readonly root: HTMLAnchorElement;
	readonly image: HTMLImageElement;
};

const createThumb = (): ThumbElements => {
	const root = externalAnchor('detail-sheet-thumb');
	const image = element('img', 'detail-sheet-thumb-image', {
		alt: '',
		loading: 'lazy',
		decoding: 'async',
	});
	root.appendChild(image);
	return { root, image };
};

type SheetElements = {
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

const createActions = (): Pick<SheetElements, 'directions' | 'osm' | 'details' | 'detailsLabel'> & {
	readonly root: HTMLElement;
} => {
	const root = element('div', 'detail-sheet-actions');

	const directions = externalAnchor('detail-sheet-directions');
	directions.append(
		iconSpan('detail-sheet-button-icon', DIRECTIONS_ICON),
		Object.assign(element('span', 'detail-sheet-button-label'), { textContent: DIRECTIONS_LABEL })
	);

	const secondary = element('div', 'detail-sheet-secondary-row');
	const osm = externalAnchor('detail-sheet-osm');
	osm.append(
		iconSpan('detail-sheet-button-icon', MAP_ICON),
		Object.assign(element('span', 'detail-sheet-button-label'), { textContent: OSM_LINK_LABEL })
	);

	const details = element('button', 'detail-sheet-details', {
		type: 'button',
		'aria-expanded': 'false',
	});
	const detailsLabel = element('span', 'detail-sheet-button-label');
	detailsLabel.textContent = DETAILS_LABEL;
	details.append(detailsLabel, iconSpan('detail-sheet-button-icon', CHEVRON_DOWN_ICON));

	secondary.append(osm, details);
	root.append(directions, secondary);
	return { root, directions, osm, details, detailsLabel };
};

const createFooter = (): { readonly root: HTMLElement; readonly identity: HTMLSpanElement } => {
	const root = element('footer', 'detail-sheet-footer');
	const provenance = element('span', 'detail-sheet-provenance');
	provenance.textContent = PROVENANCE;
	const identity = element('span', 'detail-sheet-identity');
	root.append(provenance, identity);
	return { root, identity };
};

const createElements = (): SheetElements => {
	const root = element('section', DETAIL_SHEET_CLASS, {
		role: 'dialog',
		'aria-labelledby': DETAIL_SHEET_TITLE_ID,
	});
	root.hidden = true;

	const hero = createHero();

	const head = element('div', 'detail-sheet-head');
	const kind = element('div', 'detail-sheet-kind');
	const kindIconSpan = iconSpan('detail-sheet-kind-icon', '');
	const kindLabel = element('span', 'detail-sheet-kind-label');
	const nearestTag = element('span', 'detail-sheet-nearest');
	nearestTag.textContent = NEAREST_TAG;
	kind.append(kindIconSpan, kindLabel, nearestTag);
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
		kindIcon: kindIconSpan,
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

const liveText = (live: DetailLive): string =>
	live.compassPoint === null
		? formatDistance(live.distance)
		: `${formatDistance(live.distance)} · ${live.compassPoint}`;

const warningElement = (warning: DetailWarning): HTMLElement => {
	const root = element('div', 'detail-sheet-warning', { role: 'note' });
	const title = element('strong', 'detail-sheet-warning-title');
	title.textContent = warning.title;
	const body = element('span', 'detail-sheet-warning-body');
	body.textContent = warning.body;
	root.append(title, body);
	return root;
};

const factText = (fact: DetailFact): string =>
	fact.value === null ? fact.label : `${fact.label}: ${fact.value}`;

const factElement = (fact: DetailFact): HTMLLIElement => {
	const item = element('li', 'detail-sheet-fact');
	const text = element('span', 'detail-sheet-fact-text');
	text.textContent = factText(fact);
	item.append(iconSpan('detail-sheet-fact-icon', factIcon(fact.icon)), text);
	return item;
};

const linkElement = (link: ExternalLink): HTMLAnchorElement => {
	const anchor = externalAnchor(`detail-sheet-chip detail-sheet-chip--${link.kind}`);
	anchor.href = link.url;
	const label = element('span', 'detail-sheet-chip-label');
	label.textContent = link.label;
	anchor.append(label, iconSpan('detail-sheet-chip-icon', EXTERNAL_LINK_ICON));
	return anchor;
};

const setImageSource = (image: HTMLImageElement, url: string): void => {
	if (image.getAttribute('src') !== url) {
		image.setAttribute('src', url);
	}
};

const renderPhoto = (elements: SheetElements, photo: Photo | null): void => {
	if (photo === null) {
		elements.hero.image.removeAttribute('src');
		elements.thumb.image.removeAttribute('src');
		return;
	}
	setImageSource(elements.hero.image, photo.thumbnailUrl);
	setImageSource(elements.thumb.image, photo.thumbnailUrl);
	elements.hero.link.href = photo.pageUrl;
	elements.hero.credit.href = photo.pageUrl;
	elements.thumb.root.href = photo.pageUrl;
};

const renderStatic = (elements: SheetElements, detail: DetailView): void => {
	elements.root.dataset.kind = detail.kind;
	elements.kindIcon.innerHTML = kindIcon(detail.kind);
	elements.kindLabel.textContent = detail.kindLabel;
	elements.nearestTag.hidden = !detail.nearest;
	elements.title.textContent = detail.title;
	elements.directions.href = detail.directionsUrl;
	elements.directions.setAttribute('aria-label', detail.directionsLabel);
	elements.osm.href = detail.osmUrl;
	elements.warnings.replaceChildren(...detail.warnings.map(warningElement));
	elements.warnings.hidden = detail.warnings.length === 0;
	elements.description.textContent = detail.description ?? '';
	elements.description.hidden = detail.description === null;
	elements.facts.replaceChildren(...detail.facts.map(factElement));
	elements.facts.hidden = detail.facts.length === 0;
	elements.links.replaceChildren(...detail.links.map(linkElement));
	elements.links.hidden = detail.links.length === 0;
	elements.identity.textContent = `${detail.identity} · ID: ${detail.osmId}`;
	renderPhoto(elements, detail.photo);
};

const renderLive = (elements: SheetElements, live: DetailLive): void => {
	const text = liveText(live);
	if (elements.live.textContent !== text) {
		elements.live.textContent = text;
	}
	elements.live.classList.toggle(LIVE_COURSE_CLASS, live.bearing !== null);
	if (live.bearing === null) {
		elements.live.style.removeProperty('--bearing');
	} else {
		elements.live.style.setProperty('--bearing', `${live.bearing}deg`);
	}
};

const renderExpansion = (
	elements: SheetElements,
	expansion: SheetExpansion,
	photoShown: boolean
): void => {
	const full = expansion === 'full';
	elements.root.dataset.state = expansion;
	elements.details.setAttribute('aria-expanded', full ? 'true' : 'false');
	elements.detailsLabel.textContent = full ? LESS_LABEL : DETAILS_LABEL;
	elements.collapse.hidden = !full;
	elements.more.hidden = !full;
	elements.hero.root.hidden = !full || !photoShown;
	elements.thumb.root.hidden = full || !photoShown;
};

const isEscape = (event: KeyboardEvent): boolean => event.key === 'Escape';

const expansionOf = (state: SheetState): SheetExpansion | null =>
	state.kind === 'open' ? state.expansion : null;

const facilityIdOf = (state: SheetState): string | null =>
	state.kind === 'open' ? state.facilityId : null;

export function createDetailSheet(map: L.Map, handlers: DetailSheetHandlers): DetailSheet {
	const elements = createElements();
	const container = map.getContainer();
	container.appendChild(elements.root);
	L.DomEvent.disableClickPropagation(elements.root);
	L.DomEvent.disableScrollPropagation(elements.root);

	let state: SheetState = initialSheetState;
	let detail: DetailView | null = null;
	let photoFailed = false;
	let historyPushed = false;
	let previouslyFocused: Element | null = null;

	const measuredHeight = (): number =>
		elements.root.hidden ? 0 : Math.round(elements.root.getBoundingClientRect().height);

	const publishHeight = (): void => {
		const value = `${measuredHeight()}px`;
		container.style.setProperty(SHEET_HEIGHT_PROPERTY, value);
		document.documentElement.style.setProperty(SHEET_HEIGHT_PROPERTY, value);
	};

	const applyExpansion = (): void => {
		const expansion = expansionOf(state);
		if (expansion === null) {
			return;
		}
		const photoShown = detail !== null && detail.photo !== null && !photoFailed;
		renderExpansion(elements, expansion, photoShown);
		publishHeight();
	};

	const dispatch = (event: SheetEvent): void => {
		state = applySheet(state, event);
		applyExpansion();
	};

	const reveal = (coordinates: Coordinates): void => {
		const size = map.getSize();
		if (size.x === 0 || size.y === 0) {
			return;
		}
		map.panInside([coordinates.lat, coordinates.lon], {
			paddingBottomRight: [0, measuredHeight() + REVEAL_GAP_PX],
			paddingTopLeft: [0, REVEAL_GAP_PX],
		});
	};

	const pushHistory = (): void => {
		if (historyPushed) {
			return;
		}
		try {
			history.pushState({ [HISTORY_STATE_KEY]: true }, '');
			historyPushed = true;
		} catch {
			historyPushed = false;
		}
	};

	const popHistory = (): void => {
		if (!historyPushed) {
			return;
		}
		historyPushed = false;
		try {
			history.back();
		} catch {
			return;
		}
	};

	const restoreFocus = (): void => {
		const target = previouslyFocused;
		previouslyFocused = null;
		if (target instanceof HTMLElement && document.contains(target)) {
			target.focus();
		}
	};

	const onKeyDown = (event: KeyboardEvent): void => {
		if (isEscape(event) && state.kind === 'open') {
			event.preventDefault();
			closeByUser();
		}
	};

	const onPopState = (): void => {
		if (state.kind === 'open') {
			historyPushed = false;
			closeByUser();
		}
	};

	const onMapClick = (): void => {
		if (state.kind === 'open') {
			closeByUser();
		}
	};

	const hide = (): void => {
		if (state.kind === 'closed') {
			return;
		}
		state = applySheet(state, { kind: 'hidden' });
		detail = null;
		elements.root.hidden = true;
		document.removeEventListener('keydown', onKeyDown, true);
		publishHeight();
		restoreFocus();
		popHistory();
	};

	const closeByUser = (): void => {
		hide();
		handlers.onClose();
	};

	const open = (): void => {
		previouslyFocused = document.activeElement;
		elements.root.hidden = false;
		document.addEventListener('keydown', onKeyDown, true);
		pushHistory();
		elements.title.focus();
	};

	const show = (view: Extract<DetailSheetView, { kind: 'shown' }>): void => {
		const wasOpen = state.kind === 'open';
		const facilityChanged = facilityIdOf(state) !== view.detail.id;
		state = applySheet(state, {
			kind: 'shown',
			facilityId: view.detail.id,
			expansion: view.state,
		});
		detail = view.detail;
		if (facilityChanged) {
			photoFailed = false;
			renderStatic(elements, view.detail);
		}
		renderLive(elements, view.detail.live);
		if (!wasOpen) {
			open();
		}
		applyExpansion();
		if (facilityChanged) {
			reveal(view.detail.coordinates);
		}
	};

	const render = (view: DetailSheetView): void => {
		switch (view.kind) {
			case 'hidden':
				hide();
				return;
			case 'shown':
				show(view);
				return;
			default: {
				const exhaustive: never = view;
				throw new Error(`Unhandled detail sheet view: ${JSON.stringify(exhaustive)}`);
			}
		}
	};

	const onPhotoError = (): void => {
		photoFailed = true;
		applyExpansion();
	};

	elements.hero.image.addEventListener('error', onPhotoError);
	elements.thumb.image.addEventListener('error', onPhotoError);
	elements.close.addEventListener('click', closeByUser);
	elements.collapse.addEventListener('click', () => dispatch({ kind: 'collapsed' }));
	elements.details.addEventListener('click', () => dispatch({ kind: 'toggled' }));
	elements.directions.addEventListener('click', () => {
		if (detail !== null) {
			handlers.onDirections(detail);
		}
	});
	window.addEventListener('popstate', onPopState);
	map.on('click', onMapClick);

	const observer =
		typeof ResizeObserver === 'function' ? new ResizeObserver(() => publishHeight()) : null;
	observer?.observe(elements.root);
	publishHeight();

	return {
		render,
		destroy: () => {
			hide();
			observer?.disconnect();
			window.removeEventListener('popstate', onPopState);
			map.off('click', onMapClick);
			elements.root.remove();
		},
	};
}
