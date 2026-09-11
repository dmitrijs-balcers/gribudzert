import { RERANK_MIN_MOVE_M } from '../../core/config';
import type { Facility, LatLon, Located, UserPosition, WaterFacility } from '../../domain';
import { applyGuidance, distanceBetween, isGuidedTo, isWaterFacility } from '../../domain';
import type { LayerKind } from '../layers';
import type { GuidanceAppEffect } from './effects';
import type { GuidanceAppEvent } from './events';
import type { GuidanceAppState } from './state';
import { revealedTargetOf } from './view';

type Step = readonly [GuidanceAppState, readonly GuidanceAppEffect[]];

const unchanged = (state: GuidanceAppState): Step => [state, []];

export const needsReranking = (state: GuidanceAppState, position: LatLon): boolean => {
	if (state.selection.kind === 'open') {
		return false;
	}
	if (state.rankedFrom === null) {
		return true;
	}
	return distanceBetween(state.rankedFrom, position) >= RERANK_MIN_MOVE_M;
};

const rerankFrom = (state: GuidanceAppState, position: LatLon): Step =>
	needsReranking(state, position)
		? [{ ...state, rankedFrom: position }, [{ kind: 'origin-moved', position }]]
		: unchanged(state);

const toLocatedWater = (item: Located<Facility>): Located<WaterFacility> | null =>
	isWaterFacility(item.facility)
		? { facility: item.facility, distance: item.distance, isNearest: item.isNearest }
		: null;

const handlePositionUpdated = (state: GuidanceAppState, position: UserPosition): Step =>
	rerankFrom({ ...state, position }, position);

const handleNearestWaterChanged = (
	state: GuidanceAppState,
	nearest: Located<Facility> | null
): Step => {
	if (nearest === null) {
		return unchanged({ ...state, nearestWater: null });
	}
	const water = toLocatedWater(nearest);
	return water === null ? unchanged(state) : unchanged({ ...state, nearestWater: water });
};

const handleFacilitySelected = (state: GuidanceAppState, item: Located<Facility>): Step => {
	const opened: GuidanceAppState = { ...state, selection: { kind: 'open', item } };
	if (isGuidedTo(state.guidance, item.facility)) {
		return unchanged(opened);
	}
	return [
		{
			...opened,
			guidance: applyGuidance(state.guidance, { kind: 'facility-chosen', facility: item.facility }),
		},
		[{ kind: 'guidance-started', facilityKind: item.facility.kind }],
	];
};

const handleTargetRevealed = (state: GuidanceAppState): Step => {
	const item = revealedTargetOf(state);
	if (item === null) {
		return unchanged(state);
	}
	return [
		{ ...state, selection: { kind: 'open', item } },
		[{ kind: 'fly-to', coordinates: item.facility.coordinates }],
	];
};

const closeSheet = (state: GuidanceAppState): Step => {
	const closed: GuidanceAppState = { ...state, selection: { kind: 'none' } };
	return closed.position === null ? unchanged(closed) : rerankFrom(closed, closed.position);
};

const isShowingKind = (state: GuidanceAppState, layer: LayerKind): boolean =>
	state.selection.kind === 'open' && state.selection.item.facility.kind === layer;

const handleLayerToggled = (state: GuidanceAppState, layer: LayerKind, active: boolean): Step => {
	const withLayer: GuidanceAppState =
		layer === 'water' ? { ...state, waterLayerActive: active } : state;
	if (active) {
		return unchanged(withLayer);
	}
	const disabled: GuidanceAppState = {
		...withLayer,
		nearestWater: layer === 'water' ? null : withLayer.nearestWater,
		guidance: applyGuidance(withLayer.guidance, { kind: 'layer-disabled', layer }),
	};
	return isShowingKind(disabled, layer) ? closeSheet(disabled) : unchanged(disabled);
};

export const applyGuidanceApp = (state: GuidanceAppState, event: GuidanceAppEvent): Step => {
	switch (event.kind) {
		case 'position-updated':
			return handlePositionUpdated(state, event.position);
		case 'nearest-water-changed':
			return handleNearestWaterChanged(state, event.nearest);
		case 'facility-selected':
			return handleFacilitySelected(state, event.item);
		case 'target-revealed':
			return handleTargetRevealed(state);
		case 'sheet-closed':
			return closeSheet(state);
		case 'guidance-dismissed':
			return unchanged({
				...state,
				guidance: applyGuidance(state.guidance, { kind: 'guidance-dismissed' }),
			});
		case 'layer-toggled':
			return handleLayerToggled(state, event.layer, event.active);
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
};
