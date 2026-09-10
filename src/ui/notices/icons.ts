/**
 * Inline line icons for notices: thin (`stroke-width="2"`), monochrome, 24x24 viewBox,
 * colored via `currentColor` so they follow the notice's text color. Rendered as raw
 * markup on a wrapper the caller marks `aria-hidden="true"` — colour is never the only
 * signal for tone, the icon shape carries the meaning too.
 */
import type { NoticeTone } from '../../domain';

const svg = (body: string): string =>
	`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** Neutral: information. */
const INFO_CIRCLE = svg(
	'<circle cx="12" cy="12" r="9"></circle>' +
		'<line x1="12" y1="11" x2="12" y2="16"></line>' +
		'<line x1="12" y1="7.5" x2="12.01" y2="7.5"></line>'
);

/** Success: confirmation. */
const CHECK = svg('<polyline points="4 12.5 9.5 18 20 5"></polyline>');

/** Warning: caution. */
const TRIANGLE_ALERT = svg(
	'<path d="M12 3.5 2 20.5h20L12 3.5Z"></path>' +
		'<line x1="12" y1="9.5" x2="12" y2="14.5"></line>' +
		'<line x1="12" y1="17.5" x2="12.01" y2="17.5"></line>'
);

/** Error: something failed. */
const CIRCLE_ALERT = svg(
	'<circle cx="12" cy="12" r="9"></circle>' +
		'<line x1="12" y1="7.5" x2="12" y2="13"></line>' +
		'<line x1="12" y1="16" x2="12.01" y2="16"></line>'
);

/** Card affordance: there is an action to take. */
export const ARROW_UP = svg(
	'<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>'
);

/** The line icon that carries a notice's tone, independent of its colour. */
export const toneIcon = (tone: NoticeTone): string => {
	switch (tone) {
		case 'neutral':
			return INFO_CIRCLE;
		case 'success':
			return CHECK;
		case 'warning':
			return TRIANGLE_ALERT;
		case 'error':
			return CIRCLE_ALERT;
		default: {
			const exhaustive: never = tone;
			throw new Error(`Unhandled notice tone: ${JSON.stringify(exhaustive)}`);
		}
	}
};
