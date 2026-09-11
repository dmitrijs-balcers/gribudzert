import type { Facility, ViewpointProminence, WaterSourceType } from '../../domain';

/**
 * A marker badge's icon: an emoji glyph, or inline SVG markup for cases an emoji can't
 * represent well (e.g. the viewpoint starburst).
 */
export type Glyph =
	| { readonly kind: 'emoji'; readonly char: string }
	| { readonly kind: 'svg'; readonly markup: string };

export type FacilityPresentation = {
	readonly glyph: Glyph;
	readonly label: string;
	readonly badgeColor: string;
};

const emoji = (char: string): Glyph => ({ kind: 'emoji', char });

export const WATER_SOURCE_PRESENTATION: Readonly<Record<WaterSourceType, FacilityPresentation>> = {
	drinking_water: { glyph: emoji('🚰'), label: 'Drinking Water', badgeColor: '#2196F3' },
	water_tap: { glyph: emoji('🚰'), label: 'Water Tap', badgeColor: '#2196F3' },
	spring: { glyph: emoji('💧'), label: 'Natural Spring', badgeColor: '#00BCD4' },
	water_well: { glyph: emoji('🪣'), label: 'Water Well', badgeColor: '#8D6E63' },
	water_point: { glyph: emoji('🌊'), label: 'Water Point', badgeColor: '#009688' },
};

export const TOILET_PRESENTATION: FacilityPresentation = {
	glyph: emoji('🚻'),
	label: 'Public Toilet',
	badgeColor: '#795548',
};

const VIEWPOINT_GLYPH_MARKUP =
	'<svg class="facility-marker-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2 L14 10 L12 12 L10 10 Z M22 12 L14 14 L12 12 L14 10 Z M12 22 L10 14 L12 12 L14 14 Z M2 12 L10 10 L12 12 L10 14 Z"/><path fill="currentColor" d="M19 5 L14 11 L12 12 L13 10 Z M19 19 L13 14 L12 12 L14 13 Z M5 19 L10 13 L12 12 L11 14 Z M5 5 L11 10 L12 12 L10 11 Z"/></svg>';

export const VIEWPOINT_PRESENTATION: FacilityPresentation = {
	glyph: { kind: 'svg', markup: VIEWPOINT_GLYPH_MARKUP },
	label: 'Viewpoint',
	badgeColor: '#43A047',
};

/**
 * Badge colour per viewpoint prominence tier; overrides `VIEWPOINT_PRESENTATION.badgeColor`
 * (which matches the `named` tier) for `bare` and `notable` viewpoints.
 */
export const VIEWPOINT_BADGE_COLORS: Readonly<Record<ViewpointProminence, string>> = {
	bare: '#66BB6A',
	named: '#43A047',
	notable: '#2E7D32',
};

export const NON_DRINKABLE_BADGE_COLOR = '#FF5722';

export const presentationOf = (facility: Facility): FacilityPresentation => {
	switch (facility.kind) {
		case 'toilet':
			return TOILET_PRESENTATION;
		case 'viewpoint':
			return VIEWPOINT_PRESENTATION;
		case 'water':
			return WATER_SOURCE_PRESENTATION[facility.sourceType];
		default: {
			const exhaustive: never = facility;
			return exhaustive;
		}
	}
};
