import type { NoticeTone } from '../../domain';

const svg = (body: string): string =>
	`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const NEUTRAL_ICON = svg(
	'<circle cx="12" cy="12" r="9"></circle>' +
		'<line x1="12" y1="11" x2="12" y2="16"></line>' +
		'<line x1="12" y1="7.5" x2="12.01" y2="7.5"></line>'
);

const SUCCESS_ICON = svg('<polyline points="4 12.5 9.5 18 20 5"></polyline>');

const WARNING_ICON = svg(
	'<path d="M12 3.5 2 20.5h20L12 3.5Z"></path>' +
		'<line x1="12" y1="9.5" x2="12" y2="14.5"></line>' +
		'<line x1="12" y1="17.5" x2="12.01" y2="17.5"></line>'
);

const ERROR_ICON = svg(
	'<circle cx="12" cy="12" r="9"></circle>' +
		'<line x1="12" y1="7.5" x2="12" y2="13"></line>' +
		'<line x1="12" y1="16" x2="12.01" y2="16"></line>'
);

const ICONS_BY_TONE: Readonly<Record<NoticeTone, string>> = {
	neutral: NEUTRAL_ICON,
	success: SUCCESS_ICON,
	warning: WARNING_ICON,
	error: ERROR_ICON,
};

export const toneIcon = (tone: NoticeTone): string => ICONS_BY_TONE[tone];
