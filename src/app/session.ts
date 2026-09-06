import { EMPTY_AREA_NOTIFICATION_COOLDOWN_MS, RERANK_MIN_MOVE_M } from '../core/config';
import type {
	DurationMs,
	LatLon,
	Located,
	Timestamp,
	UserPosition,
	WaterFacility,
} from '../domain';
import { distanceBetween } from '../domain';
import type { FollowMode } from '../features/location/follow';
import type { LayerKind } from './layers';

export type OriginSource = 'user' | 'map-center';

export type Origin = {
	readonly source: OriginSource;
	readonly position: LatLon;
};

export type AppState = {
	readonly userLocation: UserPosition | null;
	readonly rankedFrom: LatLon | null;
	readonly popupOpen: boolean;
	readonly followMode: FollowMode;
	readonly nearestWater: Located<WaterFacility> | null;
	readonly zoomedOutNoticeShown: boolean;
	readonly emptyAreaNotifiedAt: Readonly<Record<LayerKind, Timestamp | null>>;
};

export const initialState = (userLocation: UserPosition | null = null): AppState => ({
	userLocation,
	rankedFrom: null,
	popupOpen: false,
	followMode: 'off',
	nearestWater: null,
	zoomedOutNoticeShown: false,
	emptyAreaNotifiedAt: { water: null, toilet: null },
});

export const withPosition = (state: AppState, position: UserPosition): AppState => ({
	...state,
	userLocation: position,
});

export const withRankedFrom = (state: AppState, position: LatLon): AppState => ({
	...state,
	rankedFrom: position,
});

export const withPopupOpen = (state: AppState, open: boolean): AppState =>
	state.popupOpen === open ? state : { ...state, popupOpen: open };

export const withFollowMode = (state: AppState, mode: FollowMode): AppState =>
	state.followMode === mode ? state : { ...state, followMode: mode };

export const withNearestWater = (
	state: AppState,
	nearest: Located<WaterFacility> | null
): AppState => ({ ...state, nearestWater: nearest });

export const resolveOrigin = (state: AppState, mapCenter: LatLon): Origin =>
	state.userLocation === null
		? { source: 'map-center', position: mapCenter }
		: { source: 'user', position: state.userLocation };

export const needsReranking = (state: AppState, position: LatLon): boolean => {
	if (state.popupOpen) {
		return false;
	}
	if (state.rankedFrom === null) {
		return true;
	}
	return distanceBetween(state.rankedFrom, position) >= RERANK_MIN_MOVE_M;
};

export const withZoomedOutNotice = (state: AppState, shown: boolean): AppState =>
	state.zoomedOutNoticeShown === shown ? state : { ...state, zoomedOutNoticeShown: shown };

export const canNotifyEmptyArea = (
	state: AppState,
	kind: LayerKind,
	now: Timestamp,
	cooldown: DurationMs = EMPTY_AREA_NOTIFICATION_COOLDOWN_MS
): boolean => {
	const last = state.emptyAreaNotifiedAt[kind];
	return last === null || now - last >= cooldown;
};

export const withEmptyAreaNotified = (
	state: AppState,
	kind: LayerKind,
	now: Timestamp
): AppState => ({
	...state,
	emptyAreaNotifiedAt: { ...state.emptyAreaNotifiedAt, [kind]: now },
});

export type Session = {
	readonly get: () => AppState;
	readonly update: (transition: (state: AppState) => AppState) => AppState;
};

export const createSession = (initial: AppState = initialState()): Session => {
	let current = initial;
	return {
		get: () => current,
		update: (transition) => {
			current = transition(current);
			return current;
		},
	};
};
