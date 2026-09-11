import type {
	Facility,
	GuidanceState,
	LatLon,
	Located,
	UserPosition,
	WaterFacility,
} from '../../domain';
import { initialGuidanceState } from '../../domain';

export type SheetSelection =
	| { readonly kind: 'none' }
	| { readonly kind: 'open'; readonly item: Located<Facility> };

export type GuidanceAppState = {
	readonly guidance: GuidanceState;
	readonly nearestWater: Located<WaterFacility> | null;
	readonly position: UserPosition | null;
	readonly waterLayerActive: boolean;
	readonly selection: SheetSelection;
	readonly rankedFrom: LatLon | null;
};

export const initialGuidanceAppState: GuidanceAppState = {
	guidance: initialGuidanceState,
	nearestWater: null,
	position: null,
	waterLayerActive: true,
	selection: { kind: 'none' },
	rankedFrom: null,
};
