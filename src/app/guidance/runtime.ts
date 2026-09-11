import type { Coordinates, DirectionsApp, FacilityId, FacilityKind, LatLon } from '../../domain';
import type { DirectionsPlatform } from '../../features/directions';
import type { DetailSheetView } from '../../ui/detail-sheet';
import type { GuidanceHudView } from '../../ui/guidance-hud';
import type { GuidanceAppEffect } from './effects';
import type { GuidanceAppEvent } from './events';
import { applyGuidanceApp } from './reducer';
import type { GuidanceAppState } from './state';
import type { Beeline } from './view';
import { beelineOf, hudViewOf, selectedIdOf, sheetViewOf } from './view';

export type GuidancePorts = {
	readonly platform: DirectionsPlatform;
	readonly renderHud: (view: GuidanceHudView) => void;
	readonly renderSheet: (view: DetailSheetView) => void;
	readonly showBeeline: (from: LatLon, to: LatLon) => void;
	readonly clearBeeline: () => void;
	readonly selectMarker: (id: FacilityId | null) => void;
	readonly trackGuidanceStarted: (kind: FacilityKind) => void;
	readonly originMoved: (position: LatLon) => void;
	readonly flyTo: (coordinates: Coordinates) => void;
	readonly rememberDirectionsApp: (app: DirectionsApp) => void;
};

export type GuidanceRuntime = {
	readonly dispatch: (event: GuidanceAppEvent) => void;
};

type RenderedViews = {
	readonly hud: GuidanceHudView;
	readonly sheet: DetailSheetView;
	readonly beeline: Beeline | null;
	readonly selectedId: FacilityId | null;
};

const isList = (value: unknown): value is readonly unknown[] => Array.isArray(value);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const sameView = (a: unknown, b: unknown): boolean => {
	if (a === b) {
		return true;
	}
	if (isList(a) && isList(b)) {
		return a.length === b.length && a.every((item, index) => sameView(item, b[index]));
	}
	if (isRecord(a) && isRecord(b)) {
		const keys = Object.keys(a);
		return (
			keys.length === Object.keys(b).length &&
			keys.every((key) => key in b && sameView(a[key], b[key]))
		);
	}
	return false;
};

const viewsOf = (state: GuidanceAppState, platform: DirectionsPlatform): RenderedViews => ({
	hud: hudViewOf(state),
	sheet: sheetViewOf(state, platform),
	beeline: beelineOf(state),
	selectedId: selectedIdOf(state),
});

export const createGuidanceRuntime = (
	ports: GuidancePorts,
	initial: GuidanceAppState
): GuidanceRuntime => {
	let state = initial;
	let rendered: RenderedViews | null = null;

	const render = (next: RenderedViews): void => {
		const previous = rendered;
		rendered = next;
		if (previous === null || previous.selectedId !== next.selectedId) {
			ports.selectMarker(next.selectedId);
		}
		if (previous === null || !sameView(previous.hud, next.hud)) {
			ports.renderHud(next.hud);
		}
		if (previous === null || !sameView(previous.beeline, next.beeline)) {
			if (next.beeline === null) {
				ports.clearBeeline();
			} else {
				ports.showBeeline(next.beeline.from, next.beeline.to);
			}
		}
		if (previous === null || !sameView(previous.sheet, next.sheet)) {
			ports.renderSheet(next.sheet);
		}
	};

	const runEffect = (effect: GuidanceAppEffect): void => {
		switch (effect.kind) {
			case 'guidance-started':
				ports.trackGuidanceStarted(effect.facilityKind);
				return;
			case 'origin-moved':
				ports.originMoved(effect.position);
				return;
			case 'fly-to':
				ports.flyTo(effect.coordinates);
				return;
			case 'directions-app-remembered':
				ports.rememberDirectionsApp(effect.app);
				return;
			default: {
				const exhaustive: never = effect;
				throw new Error(`Unhandled guidance effect: ${JSON.stringify(exhaustive)}`);
			}
		}
	};

	const dispatch = (event: GuidanceAppEvent): void => {
		const [nextState, effects] = applyGuidanceApp(state, event);
		state = nextState;
		render(viewsOf(state, ports.platform));
		for (const effect of effects) {
			runEffect(effect);
		}
	};

	return { dispatch };
};
