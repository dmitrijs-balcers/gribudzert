/**
 * Application session state
 * A small immutable state record plus the pure transitions that produce the next state.
 * The `Session` store is the only mutable cell; everything it holds is replaced, never edited.
 */

import { EMPTY_AREA_NOTIFICATION_COOLDOWN_MS } from '../core/config';
import type { LatLon } from '../domain';
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
	readonly userLocation: LatLon | null;
	/** Whether the "zoom in" notice is showing for the current zoomed-out stretch */
	readonly zoomedOutNoticeShown: boolean;
	/** Timestamp of the last "nothing found" notification per layer kind */
	readonly emptyAreaNotifiedAt: Readonly<Record<LayerKind, number | null>>;
};

/**
 * State at startup
 * @param userLocation - Position detected during bootstrap, if any
 */
export const initialState = (userLocation: LatLon | null = null): AppState => ({
	userLocation,
	zoomedOutNoticeShown: false,
	emptyAreaNotifiedAt: { water: null, toilet: null },
});

/**
 * Remember a freshly detected viewer position
 */
export const withUserLocation = (state: AppState, position: LatLon): AppState => ({
	...state,
	userLocation: { lat: position.lat, lon: position.lon },
});

/**
 * Reference point for distances: the viewer when known, otherwise the map centre
 */
export const resolveOrigin = (state: AppState, mapCenter: LatLon): Origin =>
	state.userLocation === null
		? { source: 'map-center', position: mapCenter }
		: { source: 'user', position: state.userLocation };

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
