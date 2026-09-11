import type { Facility, FacilityKind, WaterFacility } from './facility';
import { facilityId } from './facility';
import type { Heading, LatLon, Meters } from './geo';
import { bearingBetween, distanceBetween } from './geo';

export type GuidanceState =
	| { readonly kind: 'nearest' }
	| { readonly kind: 'chosen'; readonly facility: Facility };

export type GuidanceEvent =
	| { readonly kind: 'facility-chosen'; readonly facility: Facility }
	| { readonly kind: 'guidance-dismissed' }
	| { readonly kind: 'layer-disabled'; readonly layer: FacilityKind };

export type GuidanceTarget =
	| { readonly kind: 'nearest-water'; readonly facility: WaterFacility }
	| { readonly kind: 'chosen'; readonly facility: Facility };

export type GuidanceCourse = {
	readonly distance: Meters;
	readonly bearing: Heading;
};

export const initialGuidanceState: GuidanceState = { kind: 'nearest' };

const handleLayerDisabled = (state: GuidanceState, layer: FacilityKind): GuidanceState =>
	state.kind === 'chosen' && state.facility.kind === layer ? initialGuidanceState : state;

export const applyGuidance = (state: GuidanceState, event: GuidanceEvent): GuidanceState => {
	switch (event.kind) {
		case 'facility-chosen':
			return { kind: 'chosen', facility: event.facility };
		case 'guidance-dismissed':
			return initialGuidanceState;
		case 'layer-disabled':
			return handleLayerDisabled(state, event.layer);
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
};

export const guidanceTargetOf = (
	state: GuidanceState,
	nearestWater: WaterFacility | null
): GuidanceTarget | null => {
	switch (state.kind) {
		case 'chosen':
			return { kind: 'chosen', facility: state.facility };
		case 'nearest':
			return nearestWater === null ? null : { kind: 'nearest-water', facility: nearestWater };
		default: {
			const exhaustive: never = state;
			return exhaustive;
		}
	}
};

export const guidanceCourse = (from: LatLon, target: GuidanceTarget): GuidanceCourse => ({
	distance: distanceBetween(from, target.facility.coordinates),
	bearing: bearingBetween(from, target.facility.coordinates),
});

export const isGuidedTo = (state: GuidanceState, facility: Facility): boolean =>
	state.kind === 'chosen' && facilityId(state.facility.osm) === facilityId(facility.osm);
