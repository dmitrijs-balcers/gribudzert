import type { Facility, WaterSourceType } from '../../domain';

export type FacilityPresentation = {
	readonly glyph: string;
	readonly label: string;
	readonly badgeColor: string;
};

export const WATER_SOURCE_PRESENTATION: Readonly<Record<WaterSourceType, FacilityPresentation>> = {
	drinking_water: { glyph: '🚰', label: 'Drinking Water', badgeColor: '#2196F3' },
	water_tap: { glyph: '🚰', label: 'Water Tap', badgeColor: '#2196F3' },
	spring: { glyph: '💧', label: 'Natural Spring', badgeColor: '#00BCD4' },
	water_well: { glyph: '🪣', label: 'Water Well', badgeColor: '#8D6E63' },
	water_point: { glyph: '🌊', label: 'Water Point', badgeColor: '#009688' },
};

export const TOILET_PRESENTATION: FacilityPresentation = {
	glyph: '🚻',
	label: 'Public Toilet',
	badgeColor: '#795548',
};

export const NON_DRINKABLE_BADGE_COLOR = '#FF5722';

export const presentationOf = (facility: Facility): FacilityPresentation =>
	facility.kind === 'toilet' ? TOILET_PRESENTATION : WATER_SOURCE_PRESENTATION[facility.sourceType];
