/**
 * Application session state
 * A small immutable state record plus the pure transitions that produce the next state.
 * The `Session` store is the only mutable cell; everything it holds is replaced, never edited.
 */

import { EMPTY_AREA_NOTIFICATION_COOLDOWN_MS, RERANK_MIN_MOVE_M } from '../core/config';
import type { LatLon, Located, UserPosition, WaterFacility } from '../domain';
import { distanceBetween } from '../domain';
import type { FollowMode } from '../features/location/follow';
import type { LayerKind } from './layers';

/**
 * Where the reference point for distances comes from
 */
export type OriginSource = 'user' | 'map-center';

/**
 * Reference point used to compute distances and pick the nearest facility
 */
export type Origin = {
	readonly source: OriginSource;
	readonly position: LatLon;
};

/**
 * Immutable application state
 */
export type AppState = {
	/** Last known viewer position, if it was ever detected */
	readonly userLocation: UserPosition | null;
	/** Origin the facilities were last ranked from, if ever */
	readonly rankedFrom: LatLon | null;
	/** Whether a facility popup is currently open (re-ranking is skipped while it is) */
	readonly popupOpen: boolean;
	/** Whether the map is following the live position */
	readonly followMode: FollowMode;
	/** Nearest water facility known from the last ranking, if any */
	readonly nearestWater: Located<WaterFacility> | null;
	/** Whether the "zoom in" notice is showing for the current zoomed-out stretch */
	readonly zoomedOutNoticeShown: boolean;
	/** Timestamp of the last "nothing found" notification per layer kind */
	readonly emptyAreaNotifiedAt: Readonly<Record<LayerKind, number | null>>;
};

/**
 * State at startup
 * @param userLocation - Position detected during bootstrap (live or remembered), if any
 */
export const initialState = (userLocation: UserPosition | null = null): AppState => ({
	userLocation,
	rankedFrom: null,
	popupOpen: false,
	followMode: 'off',
	nearestWater: null,
	zoomedOutNoticeShown: false,
	emptyAreaNotifiedAt: { water: null, toilet: null },
});

/**
 * Remember a freshly detected viewer position
 */
export const withPosition = (state: AppState, position: UserPosition): AppState => ({
	...state,
	userLocation: position,
});

/**
 * Record the origin facilities were just ranked from
 */
export const withRankedFrom = (state: AppState, position: LatLon): AppState => ({
	...state,
	rankedFrom: { lat: position.lat, lon: position.lon },
});

/**
 * Record whether a facility popup is currently open
 */
export const withPopupOpen = (state: AppState, open: boolean): AppState =>
	state.popupOpen === open ? state : { ...state, popupOpen: open };

/**
 * Record whether the map is following the live position
 */
export const withFollowMode = (state: AppState, mode: FollowMode): AppState =>
	state.followMode === mode ? state : { ...state, followMode: mode };

/**
 * Record the nearest water facility known from the last ranking
 */
export const withNearestWater = (
	state: AppState,
	nearest: Located<WaterFacility> | null
): AppState => ({ ...state, nearestWater: nearest });

/**
 * Reference point for distances: the viewer when known, otherwise the map centre
 */
export const resolveOrigin = (state: AppState, mapCenter: LatLon): Origin =>
	state.userLocation === null
		? { source: 'map-center', position: mapCenter }
		: { source: 'user', position: state.userLocation };

/**
 * Whether facilities should be re-ranked from `position`: never ranked yet, or the runner
 * moved at least `RERANK_MIN_MOVE_M` since the last ranking, and no popup is open
 */
export const needsReranking = (state: AppState, position: LatLon): boolean => {
	if (state.popupOpen) {
		return false;
	}
	if (state.rankedFrom === null) {
		return true;
	}
	return distanceBetween(state.rankedFrom, position) >= RERANK_MIN_MOVE_M;
};

/**
 * Record whether the zoomed-out notice is currently shown
 */
export const withZoomedOutNotice = (state: AppState, shown: boolean): AppState =>
	state.zoomedOutNoticeShown === shown ? state : { ...state, zoomedOutNoticeShown: shown };

/**
 * Whether a "nothing found" notification may be shown for `kind` at time `now`
 * @param cooldown - Minimum interval between two notifications of the same kind
 */
export const canNotifyEmptyArea = (
	state: AppState,
	kind: LayerKind,
	now: number,
	cooldown: number = EMPTY_AREA_NOTIFICATION_COOLDOWN_MS
): boolean => {
	const last = state.emptyAreaNotifiedAt[kind];
	return last === null || now - last >= cooldown;
};

/**
 * Record that a "nothing found" notification was shown for `kind` at time `now`
 */
export const withEmptyAreaNotified = (state: AppState, kind: LayerKind, now: number): AppState => ({
	...state,
	emptyAreaNotifiedAt: { ...state.emptyAreaNotifiedAt, [kind]: now },
});

/**
 * Holder of the current state
 */
export type Session = {
	/** Current state */
	readonly get: () => AppState;
	/** Replace the state with the result of `transition` and return it */
	readonly update: (transition: (state: AppState) => AppState) => AppState;
};

/**
 * Create a session store
 */
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
