import type {
	Facility,
	FacilityId,
	GuidanceCourse,
	GuidanceTarget,
	LatLon,
	Located,
	UserPosition,
} from '../../domain';
import {
	bearingBetween,
	compassPointOf,
	distanceBetween,
	guidanceCourse,
	guidanceTargetOf,
} from '../../domain';
import { detailViewOf } from '../../features/detail';
import type { DirectionsPlatform } from '../../features/directions';
import type { Glyph } from '../../features/presentation';
import { presentationOf } from '../../features/presentation';
import type { DetailSheetView } from '../../ui/detail-sheet';
import type { GuidanceHudView } from '../../ui/guidance-hud';
import type { GuidanceAppState } from './state';

export const NEAREST_WATER_GLYPH: Glyph = { kind: 'emoji', char: '🚰' };
export const NEAREST_WATER_TITLE = 'Nearest water';

export type Beeline = {
	readonly from: LatLon;
	readonly to: LatLon;
};

export const targetOf = (state: GuidanceAppState): GuidanceTarget | null =>
	guidanceTargetOf(
		state.guidance,
		state.waterLayerActive ? (state.nearestWater?.facility ?? null) : null
	);

const isTargetFacility = (target: GuidanceTarget, facility: Facility): boolean =>
	target.facility.id === facility.id;

const courseFrom = (position: UserPosition, facility: Facility): GuidanceCourse => ({
	distance: distanceBetween(position, facility.coordinates),
	bearing: bearingBetween(position, facility.coordinates),
});

export const guidanceHudViewOf = (
	target: GuidanceTarget,
	course: GuidanceCourse
): GuidanceHudView => {
	const shown = {
		kind: 'shown',
		distance: course.distance,
		bearing: course.bearing,
		label: compassPointOf(course.bearing),
	} as const;
	switch (target.kind) {
		case 'nearest-water':
			return {
				...shown,
				glyph: NEAREST_WATER_GLYPH,
				title: NEAREST_WATER_TITLE,
				dismissible: false,
			};
		case 'chosen': {
			const presentation = presentationOf(target.facility);
			return {
				...shown,
				glyph: presentation.glyph,
				title: `Guiding to ${presentation.label}`,
				dismissible: true,
			};
		}
		default: {
			const exhaustive: never = target;
			return exhaustive;
		}
	}
};

export const hudViewOf = (state: GuidanceAppState): GuidanceHudView => {
	const target = targetOf(state);
	if (state.position === null || target === null || state.selection.kind === 'open') {
		return { kind: 'hidden' };
	}
	return guidanceHudViewOf(target, guidanceCourse(state.position, target));
};

export const beelineOf = (state: GuidanceAppState): Beeline | null => {
	const target = targetOf(state);
	if (state.position === null || target === null) {
		return null;
	}
	return {
		from: { lat: state.position.lat, lon: state.position.lon },
		to: target.facility.coordinates,
	};
};

const liveCourseOf = (
	state: GuidanceAppState,
	position: UserPosition,
	facility: Facility
): GuidanceCourse => {
	const target = targetOf(state);
	return target !== null && isTargetFacility(target, facility)
		? guidanceCourse(position, target)
		: courseFrom(position, facility);
};

export const sheetViewOf = (
	state: GuidanceAppState,
	platform: DirectionsPlatform
): DetailSheetView => {
	switch (state.selection.kind) {
		case 'none':
			return { kind: 'hidden' };
		case 'open': {
			const { item } = state.selection;
			const course =
				state.position === null ? null : liveCourseOf(state, state.position, item.facility);
			return { kind: 'shown', detail: detailViewOf(item, course, platform) };
		}
		default: {
			const exhaustive: never = state.selection;
			return exhaustive;
		}
	}
};

export const selectedIdOf = (state: GuidanceAppState): FacilityId | null =>
	state.selection.kind === 'open' ? state.selection.item.facility.id : null;

export const revealedTargetOf = (state: GuidanceAppState): Located<Facility> | null => {
	const target = targetOf(state);
	if (target === null || state.position === null) {
		return null;
	}
	return {
		facility: target.facility,
		distance: distanceBetween(state.position, target.facility.coordinates),
		isNearest: state.nearestWater !== null && isTargetFacility(target, state.nearestWater.facility),
	};
};
