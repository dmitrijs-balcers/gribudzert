import * as L from 'leaflet';
import type { Facility, FacilityKind, WaterSourceType } from '../../domain';
import { NON_DRINKABLE_BADGE_COLOR, presentationOf } from './presentation';

export const NEAREST_MARKER_CLASS = 'nearest-marker';
export const NON_DRINKABLE_MARKER_CLASS = 'non-drinkable-marker';
export const SEASONAL_MARKER_CLASS = 'seasonal-marker';

export type MarkerEmphasis = 'normal' | 'nearest';
export type MarkerPotability = 'drinkable' | 'not-drinkable';

export type MarkerAppearance = {
	readonly glyph: string;
	readonly badgeColor: string;
	readonly accessibleLabel: string;
	readonly emphasis: MarkerEmphasis;
	readonly potability: MarkerPotability;
	readonly seasonal: boolean;
	readonly facilityKind: FacilityKind;
	readonly facilityType: WaterSourceType | 'toilet';
};

export type AppearanceOptions = {
	readonly isNearest: boolean;
};

const potabilityOf = (facility: Facility): MarkerPotability =>
	facility.kind === 'water' && !facility.drinkable ? 'not-drinkable' : 'drinkable';

const badgeColorOf = (potability: MarkerPotability, presentationBadgeColor: string): string =>
	potability === 'not-drinkable' ? NON_DRINKABLE_BADGE_COLOR : presentationBadgeColor;

const accessibleLabelOf = (
	label: string,
	potability: MarkerPotability,
	emphasis: MarkerEmphasis
): string => {
	const suffixes: string[] = [];
	if (potability === 'not-drinkable') {
		suffixes.push('not drinkable');
	}
	if (emphasis === 'nearest') {
		suffixes.push('nearest');
	}
	return [label, ...suffixes].join(', ');
};

export const appearanceOf = (facility: Facility, options: AppearanceOptions): MarkerAppearance => {
	const presentation = presentationOf(facility);
	const potability = potabilityOf(facility);
	const emphasis: MarkerEmphasis = options.isNearest ? 'nearest' : 'normal';
	return {
		glyph: presentation.glyph,
		badgeColor: badgeColorOf(potability, presentation.badgeColor),
		accessibleLabel: accessibleLabelOf(presentation.label, potability, emphasis),
		emphasis,
		potability,
		seasonal: facility.kind === 'water' && facility.seasonal,
		facilityKind: facility.kind,
		facilityType: facility.kind === 'water' ? facility.sourceType : 'toilet',
	};
};

const BADGE_SIZE_PX = 30;
const NEAREST_BADGE_SIZE_PX = 36;
const POPUP_ANCHOR_GAP_PX = 6;

const classNames = (...names: readonly (string | false | undefined)[]): string =>
	names.filter((name): name is string => typeof name === 'string' && name !== '').join(' ');

const facilityBadgeHtml = (appearance: MarkerAppearance): string =>
	`<div class="facility-marker-badge" style="background-color:${appearance.badgeColor};">` +
	`<span class="facility-marker-glyph" aria-hidden="true">${appearance.glyph}</span>` +
	(appearance.potability === 'not-drinkable'
		? '<span class="facility-marker-strike" aria-hidden="true"></span>'
		: '') +
	'</div>';

const iconClassNameOf = (appearance: MarkerAppearance): string =>
	classNames(
		'facility-marker',
		`facility-marker--${appearance.facilityKind}`,
		appearance.emphasis === 'nearest' && NEAREST_MARKER_CLASS,
		appearance.potability === 'not-drinkable' && NON_DRINKABLE_MARKER_CLASS,
		appearance.seasonal && SEASONAL_MARKER_CLASS
	);

const badgeSizeOf = (appearance: MarkerAppearance): number =>
	appearance.emphasis === 'nearest' ? NEAREST_BADGE_SIZE_PX : BADGE_SIZE_PX;

export const createFacilityIcon = (appearance: MarkerAppearance): L.DivIcon => {
	const size = badgeSizeOf(appearance);
	const anchor = size / 2;
	return L.divIcon({
		html: facilityBadgeHtml(appearance),
		className: iconClassNameOf(appearance),
		iconSize: [size, size],
		iconAnchor: [anchor, anchor],
		popupAnchor: [0, -(anchor + POPUP_ANCHOR_GAP_PX)],
	});
};

export type RootAttributes = Readonly<Record<string, string>>;

export const rootAttributesOf = (appearance: MarkerAppearance): RootAttributes => ({
	title: appearance.accessibleLabel,
	'aria-label': appearance.accessibleLabel,
	'data-facility-kind': appearance.facilityKind,
	'data-facility-type': appearance.facilityType,
});
