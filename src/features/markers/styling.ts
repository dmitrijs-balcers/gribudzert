import * as L from 'leaflet';
import type {
	Facility,
	FacilityKind,
	Meters,
	ViewpointProminence,
	WaterSourceType,
} from '../../domain';
import { formatDistance } from '../../domain';
import type { Glyph } from './presentation';
import { NON_DRINKABLE_BADGE_COLOR, presentationOf, VIEWPOINT_BADGE_COLORS } from './presentation';
import './markers.css';

export const NEAREST_MARKER_CLASS = 'nearest-marker';
export const NOTABLE_MARKER_CLASS = 'notable-marker';
export const NON_DRINKABLE_MARKER_CLASS = 'non-drinkable-marker';
export const SEASONAL_MARKER_CLASS = 'seasonal-marker';

export type MarkerEmphasis = 'normal' | 'nearest';
export type MarkerPotability = 'drinkable' | 'not-drinkable';

export type MarkerAppearance = {
	readonly glyph: Glyph;
	readonly badgeColor: string;
	readonly accessibleLabel: string;
	readonly emphasis: MarkerEmphasis;
	readonly potability: MarkerPotability;
	readonly seasonal: boolean;
	readonly facilityKind: FacilityKind;
	readonly facilityType: WaterSourceType | 'toilet' | 'viewpoint';
	readonly distanceLabel: string | null;
	readonly prominence: ViewpointProminence | null;
};

export type AppearanceOptions = {
	readonly isNearest: boolean;
	readonly distance: Meters;
};

const potabilityOf = (facility: Facility): MarkerPotability =>
	facility.kind === 'water' && !facility.drinkable ? 'not-drinkable' : 'drinkable';

const badgeColorOf = (potability: MarkerPotability, presentationBadgeColor: string): string =>
	potability === 'not-drinkable' ? NON_DRINKABLE_BADGE_COLOR : presentationBadgeColor;

const facilityTypeOf = (facility: Facility): WaterSourceType | 'toilet' | 'viewpoint' =>
	facility.kind === 'water' ? facility.sourceType : facility.kind;

const accessibleLabelOf = (
	label: string,
	potability: MarkerPotability,
	emphasis: MarkerEmphasis,
	distanceLabel: string | null,
	prominence: ViewpointProminence | null
): string => {
	const suffixes: string[] = [];
	if (potability === 'not-drinkable') {
		suffixes.push('not drinkable');
	}
	if (prominence === 'notable') {
		suffixes.push('with photo or article');
	}
	if (emphasis === 'nearest') {
		suffixes.push('nearest');
	}
	if (distanceLabel !== null) {
		suffixes.push(`${distanceLabel} away`);
	}
	return [label, ...suffixes].join(', ');
};

export const appearanceOf = (facility: Facility, options: AppearanceOptions): MarkerAppearance => {
	const presentation = presentationOf(facility);
	const potability = potabilityOf(facility);
	const emphasis: MarkerEmphasis = options.isNearest ? 'nearest' : 'normal';
	const distanceLabel = options.isNearest ? formatDistance(options.distance) : null;
	const prominence = facility.kind === 'viewpoint' ? facility.prominence : null;
	const badgeColor =
		prominence === null
			? badgeColorOf(potability, presentation.badgeColor)
			: VIEWPOINT_BADGE_COLORS[prominence];
	return {
		glyph: presentation.glyph,
		badgeColor,
		accessibleLabel: accessibleLabelOf(
			presentation.label,
			potability,
			emphasis,
			distanceLabel,
			prominence
		),
		emphasis,
		potability,
		seasonal: facility.kind === 'water' && facility.seasonal,
		facilityKind: facility.kind,
		facilityType: facilityTypeOf(facility),
		distanceLabel,
		prominence,
	};
};

const BADGE_SIZE_PX = 30;
const NEAREST_BADGE_SIZE_PX = 36;
const VIEWPOINT_BADGE_SIZE_PX: Readonly<Record<ViewpointProminence, number>> = {
	bare: 18,
	named: 30,
	notable: 40,
};
const TAIL_HEIGHT_PX = 7;

const classNames = (...names: readonly (string | false | undefined)[]): string =>
	names.filter((name): name is string => typeof name === 'string' && name !== '').join(' ');

const facilityGlyphHtml = (glyph: Glyph): string => {
	switch (glyph.kind) {
		case 'emoji':
			return `<span class="facility-marker-glyph" aria-hidden="true">${glyph.char}</span>`;
		case 'svg':
			return glyph.markup;
		default: {
			const exhaustive: never = glyph;
			return exhaustive;
		}
	}
};

const facilityBadgeHtml = (appearance: MarkerAppearance, size: number): string =>
	`<div class="facility-marker-badge" style="background-color:${appearance.badgeColor};width:${size}px;height:${size}px;">` +
	(appearance.prominence === 'bare' ? '' : facilityGlyphHtml(appearance.glyph)) +
	(appearance.potability === 'not-drinkable'
		? '<span class="facility-marker-strike" aria-hidden="true"></span>'
		: '') +
	'</div>';

const facilityTailHtml = (appearance: MarkerAppearance): string =>
	'<div class="facility-marker-tail" aria-hidden="true">' +
	`<span class="facility-marker-tail-fill" style="border-top-color:${appearance.badgeColor};"></span>` +
	'</div>';

const facilityDistanceHtml = (appearance: MarkerAppearance): string =>
	appearance.distanceLabel === null
		? ''
		: `<div class="facility-marker-distance" aria-hidden="true">${appearance.distanceLabel}</div>`;

const iconClassNameOf = (appearance: MarkerAppearance): string =>
	classNames(
		'facility-marker',
		`facility-marker--${appearance.facilityKind}`,
		appearance.emphasis === 'nearest' && NEAREST_MARKER_CLASS,
		appearance.prominence === 'notable' && NOTABLE_MARKER_CLASS,
		appearance.potability === 'not-drinkable' && NON_DRINKABLE_MARKER_CLASS,
		appearance.seasonal && SEASONAL_MARKER_CLASS
	);

const badgeSizeOf = (appearance: MarkerAppearance): number => {
	if (appearance.prominence !== null) {
		return VIEWPOINT_BADGE_SIZE_PX[appearance.prominence];
	}
	return appearance.emphasis === 'nearest' ? NEAREST_BADGE_SIZE_PX : BADGE_SIZE_PX;
};

export const createFacilityIcon = (appearance: MarkerAppearance): L.DivIcon => {
	const size = badgeSizeOf(appearance);
	const tailTipY = size + TAIL_HEIGHT_PX;
	return L.divIcon({
		html:
			facilityBadgeHtml(appearance, size) +
			facilityTailHtml(appearance) +
			facilityDistanceHtml(appearance),
		className: iconClassNameOf(appearance),
		iconSize: [size, tailTipY],
		iconAnchor: [size / 2, tailTipY],
	});
};

export type RootAttributes = Readonly<Record<string, string>>;

export const rootAttributesOf = (appearance: MarkerAppearance): RootAttributes => ({
	title: appearance.accessibleLabel,
	'aria-label': appearance.accessibleLabel,
	'data-facility-kind': appearance.facilityKind,
	'data-facility-type': appearance.facilityType,
});
