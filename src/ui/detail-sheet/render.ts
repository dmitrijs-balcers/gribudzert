import type { ExternalLink, Photo } from '../../domain';
import { formatDistance } from '../../domain';
import type { DetailFact, DetailLive, DetailView, DetailWarning } from '../../features/detail';
import type { SheetElements } from './elements';
import { element, externalAnchor, iconSpan } from './elements';
import { EXTERNAL_LINK_ICON, factIcon, kindIcon } from './icons';
import { DETAILS_LABEL, LESS_LABEL } from './labels';
import type { SheetExpansion } from './sheet-state';

const LIVE_COURSE_CLASS = 'detail-sheet-live--course';
const BEARING_PROPERTY = '--bearing';

export const liveText = (live: DetailLive): string =>
	live.compassPoint === null
		? formatDistance(live.distance)
		: `${formatDistance(live.distance)} · ${live.compassPoint}`;

export const factText = (fact: DetailFact): string =>
	fact.value === null ? fact.label : `${fact.label}: ${fact.value}`;

export const identityText = (detail: DetailView): string =>
	`${detail.identity} · ID: ${detail.osmId}`;

const warningElement = (warning: DetailWarning): HTMLElement => {
	const root = element('div', 'detail-sheet-warning', { role: 'note' });
	const title = element('strong', 'detail-sheet-warning-title');
	title.textContent = warning.title;
	const body = element('span', 'detail-sheet-warning-body');
	body.textContent = warning.body;
	root.append(title, body);
	return root;
};

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

export const renderPhoto = (elements: SheetElements, photo: Photo | null): void => {
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

/** Rendered on every update: the chosen app can change while the sheet is open. */
export const renderDirections = (elements: SheetElements, detail: DetailView): void => {
	elements.directions.href = detail.directions.url;
	elements.directions.setAttribute('aria-label', detail.directions.label);
	const alternative = detail.alternativeDirections;
	elements.alternativeDirections.hidden = alternative === null;
	if (alternative !== null) {
		elements.alternativeDirections.href = alternative.url;
		elements.alternativeDirections.textContent = alternative.label;
	}
};

export const renderStatic = (elements: SheetElements, detail: DetailView): void => {
	elements.root.dataset.kind = detail.kind;
	elements.kindIcon.innerHTML = kindIcon(detail.kind);
	elements.kindLabel.textContent = detail.kindLabel;
	elements.nearestTag.hidden = !detail.nearest;
	elements.title.textContent = detail.title;
	renderDirections(elements, detail);
	elements.osm.href = detail.osmUrl;
	elements.warnings.replaceChildren(...detail.warnings.map(warningElement));
	elements.warnings.hidden = detail.warnings.length === 0;
	elements.description.textContent = detail.description ?? '';
	elements.description.hidden = detail.description === null;
	elements.facts.replaceChildren(...detail.facts.map(factElement));
	elements.facts.hidden = detail.facts.length === 0;
	elements.links.replaceChildren(...detail.links.map(linkElement));
	elements.links.hidden = detail.links.length === 0;
	elements.identity.textContent = identityText(detail);
	renderPhoto(elements, detail.photo);
};

export const renderLive = (elements: SheetElements, live: DetailLive): void => {
	const text = liveText(live);
	if (elements.live.textContent !== text) {
		elements.live.textContent = text;
	}
	elements.live.classList.toggle(LIVE_COURSE_CLASS, live.bearing !== null);
	if (live.bearing === null) {
		elements.live.style.removeProperty(BEARING_PROPERTY);
	} else {
		elements.live.style.setProperty(BEARING_PROPERTY, `${live.bearing}deg`);
	}
};

export const renderExpansion = (
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
