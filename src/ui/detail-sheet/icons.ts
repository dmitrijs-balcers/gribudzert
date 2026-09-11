import type { FacilityKind } from '../../domain';
import type { FactIcon } from '../../features/detail';

const svg = (body: string): string =>
	'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
	body +
	'</svg>';

const KIND_ICONS: Readonly<Record<FacilityKind, string>> = {
	water: svg('<path d="M12 3.5C9 8 6 11 6 14.5a6 6 0 0 0 12 0C18 11 15 8 12 3.5Z"></path>'),
	toilet: svg(
		'<circle cx="7.5" cy="5" r="2"></circle>' +
			'<path d="M7.5 9v11M4.5 14v-3a3 3 0 0 1 6 0v3"></path>' +
			'<circle cx="16.5" cy="5" r="2"></circle>' +
			'<path d="M16.5 9v11M13.5 15h6l-1.5-5a1.5 1.5 0 0 0-3 0Z"></path>'
	),
	viewpoint: svg(
		'<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"></path>' +
			'<circle cx="12" cy="12" r="3"></circle>'
	),
};

const FACT_ICONS: Readonly<Record<FactIcon, string>> = {
	elevation: svg(
		'<path d="M3 19 9.5 8l3.5 6 2-3 6 8Z"></path><path d="M8 10.5 9.5 8l1.5 2.5"></path>'
	),
	hours: svg('<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>'),
	wheelchair: svg(
		'<circle cx="10" cy="4.5" r="1.8"></circle>' +
			'<path d="M10 8v6h5l3 5"></path>' +
			'<path d="M10 11h4"></path>' +
			'<path d="M7.5 11.5a5 5 0 1 0 6.5 7"></path>'
	),
	'changing-table': svg(
		'<path d="M3 10h18"></path>' +
			'<path d="M6 10v9M18 10v9"></path>' +
			'<path d="M9 10V7.5a3 3 0 0 1 6 0V10"></path>'
	),
	fee: svg(
		'<circle cx="12" cy="12" r="8.5"></circle>' +
			'<path d="M12 7.5v9M14.5 10a2.5 2 0 0 0-2.5-1.5c-1.5 0-2.5.8-2.5 1.75S10.5 12 12 12s2.5.8 2.5 1.75S13.5 15.5 12 15.5A2.5 2 0 0 1 9.5 14"></path>'
	),
	unisex: svg(
		'<circle cx="8" cy="6" r="2.5"></circle>' +
			'<path d="M3.5 20v-5a4.5 4.5 0 0 1 9 0v5"></path>' +
			'<circle cx="17" cy="7" r="2"></circle>' +
			'<path d="M14.5 20v-4a3 3 0 0 1 6 0v4"></path>'
	),
	seasonal: svg(
		'<circle cx="12" cy="12" r="3.5"></circle>' +
			'<path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"></path>'
	),
	bottle: svg(
		'<path d="M10 3h4M10 3v3l-2 3v11a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9l-2-3V3"></path><path d="M8 13h8"></path>'
	),
	operator: svg(
		'<rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M3 12h18"></path>'
	),
	note: svg(
		'<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8Z"></path><path d="M14 3v5h5M9 13h6M9 17h6"></path>'
	),
};

export const kindIcon = (kind: FacilityKind): string => KIND_ICONS[kind];

export const factIcon = (icon: FactIcon): string => FACT_ICONS[icon];

export const CLOSE_ICON = svg('<path d="M6 6l12 12M18 6 6 18"></path>');

export const CHEVRON_DOWN_ICON = svg('<path d="m6 9 6 6 6-6"></path>');

export const EXTERNAL_LINK_ICON = svg(
	'<path d="M14 4h6v6M20 4l-9 9"></path><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"></path>'
);

export const DIRECTIONS_ICON = svg('<path d="M3 11l18-8-8 18-2-8Z"></path>');

export const MAP_ICON = svg(
	'<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2Z"></path><path d="M9 4v14M15 6v14"></path>'
);
