import { POSITION_STALE_AFTER_MS, QUICK_FIX_OPTIONS, WATCH_OPTIONS } from '../../core/config';
import type { DurationMs, Timestamp, UserPosition } from '../../domain';
import { timestampNow, toUserPosition } from '../../domain';
import type { LocationError } from '../../types/errors';

export type TrackingState =
	| { readonly kind: 'idle' }
	| { readonly kind: 'acquiring'; readonly lastKnown: UserPosition | null }
	| {
			readonly kind: 'tracking';
			readonly position: UserPosition;
			readonly freshness: 'live' | 'stale';
	  }
	| { readonly kind: 'paused'; readonly lastKnown: UserPosition | null }
	| {
			readonly kind: 'failed';
			readonly error: LocationError;
			readonly lastKnown: UserPosition | null;
	  };

export type GeolocationAdapter = Pick<
	Geolocation,
	'getCurrentPosition' | 'watchPosition' | 'clearWatch'
>;

export type VisibilityDeps = Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;

export type TrackerDeps = {
	readonly geolocation: GeolocationAdapter;
	readonly permissionState: () => Promise<PermissionState | 'unknown'>;
	readonly now: () => Timestamp;
	readonly visibility: VisibilityDeps;
	readonly quickFixOptions: PositionOptions;
	readonly watchOptions: PositionOptions;
	readonly staleAfterMs: DurationMs;
};

export type LocationTracker = {
	readonly state: () => TrackingState;
	readonly subscribe: (listener: (state: TrackingState) => void) => () => void;
	readonly start: () => void;
	readonly stop: () => void;
};

const isSecureContext = (): boolean =>
	location.protocol === 'https:' ||
	location.hostname === 'localhost' ||
	location.hostname === '127.0.0.1';

const hasGeolocation = (): boolean => {
	const geolocation: Geolocation | null | undefined = navigator.geolocation;
	return (
		geolocation !== null &&
		geolocation !== undefined &&
		typeof geolocation.getCurrentPosition === 'function'
	);
};

const checkAvailability = (): LocationError | null => {
	if (!hasGeolocation()) {
		return { type: 'not-supported', message: 'Geolocation is not supported in this browser' };
	}
	if (!isSecureContext()) {
		return {
			type: 'not-supported',
			message: 'Geolocation requires a secure context (HTTPS or localhost)',
		};
	}
	return null;
};

export const mapGeolocationError = (error: GeolocationPositionError): LocationError => {
	switch (error.code) {
		case error.PERMISSION_DENIED:
			return { type: 'permission-denied', message: 'User denied location permission' };
		case error.POSITION_UNAVAILABLE:
			return { type: 'position-unavailable', message: 'Location information is unavailable' };
		case error.TIMEOUT:
			return { type: 'timeout', message: 'Location request timed out' };
		default:
			return {
				type: 'position-unavailable',
				message: `Unknown geolocation error: ${error.message}`,
			};
	}
};

const defaultGeolocationAdapter: GeolocationAdapter = {
	getCurrentPosition: (success, failure, options) =>
		navigator.geolocation.getCurrentPosition(success, failure, options),
	watchPosition: (success, failure, options) =>
		navigator.geolocation.watchPosition(success, failure, options),
	clearWatch: (id) => navigator.geolocation.clearWatch(id),
};

const defaultPermissionState = async (): Promise<PermissionState | 'unknown'> => {
	if (!('permissions' in navigator)) {
		return 'unknown';
	}
	try {
		const status = await navigator.permissions.query({ name: 'geolocation' });
		return status.state;
	} catch {
		return 'unknown';
	}
};

export const defaultTrackerDeps: TrackerDeps = {
	geolocation: defaultGeolocationAdapter,
	permissionState: defaultPermissionState,
	now: timestampNow,
	visibility: document,
	quickFixOptions: QUICK_FIX_OPTIONS,
	watchOptions: WATCH_OPTIONS,
	staleAfterMs: POSITION_STALE_AFTER_MS,
};

export function createLocationTracker(deps: TrackerDeps = defaultTrackerDeps): LocationTracker {
	let state: TrackingState = { kind: 'idle' };
	const listeners = new Set<(state: TrackingState) => void>();
	let watchId: number | null = null;
	let staleTimer: ReturnType<typeof setTimeout> | null = null;
	let latestPosition: UserPosition | null = null;

	const setState = (next: TrackingState): void => {
		state = next;
		for (const listener of listeners) {
			listener(state);
		}
	};

	const clearStaleTimer = (): void => {
		if (staleTimer !== null) {
			clearTimeout(staleTimer);
			staleTimer = null;
		}
	};

	const scheduleStaleTimer = (position: UserPosition): void => {
		clearStaleTimer();
		const age = Math.max(0, deps.now() - position.at);
		const delay = Math.max(0, deps.staleAfterMs - age);
		staleTimer = setTimeout(() => {
			if (state.kind === 'tracking' && state.freshness === 'live') {
				setState({ kind: 'tracking', position: state.position, freshness: 'stale' });
			}
		}, delay);
	};

	const clearWatch = (): void => {
		if (watchId !== null) {
			deps.geolocation.clearWatch(watchId);
			watchId = null;
		}
		clearStaleTimer();
	};

	const acceptFix = (raw: GeolocationPosition): void => {
		const position = toUserPosition(raw);
		if (position === null) {
			return;
		}
		if (latestPosition !== null && position.at <= latestPosition.at) {
			return;
		}
		latestPosition = position;
		setState({ kind: 'tracking', position, freshness: 'live' });
		scheduleStaleTimer(position);
	};

	const handleWatchError = (error: GeolocationPositionError): void => {
		const mapped = mapGeolocationError(error);
		if (mapped.type === 'permission-denied') {
			clearWatch();
			setState({ kind: 'failed', error: mapped, lastKnown: latestPosition });
			return;
		}
		if (state.kind === 'tracking') {
			setState({ kind: 'tracking', position: state.position, freshness: 'stale' });
			return;
		}
		clearWatch();
		setState({ kind: 'failed', error: mapped, lastKnown: latestPosition });
	};

	const ignoreQuickFixError = (): void => undefined;

	const beginAcquisition = (): void => {
		deps.geolocation.getCurrentPosition(acceptFix, ignoreQuickFixError, deps.quickFixOptions);
		watchId = deps.geolocation.watchPosition(acceptFix, handleWatchError, deps.watchOptions);
	};

	const start = (): void => {
		if (state.kind === 'acquiring' || state.kind === 'tracking') {
			return;
		}
		const unavailable = checkAvailability();
		if (unavailable !== null) {
			setState({ kind: 'failed', error: unavailable, lastKnown: latestPosition });
			return;
		}
		setState({ kind: 'acquiring', lastKnown: latestPosition });
		void deps.permissionState().then((permission) => {
			if (state.kind !== 'acquiring') {
				return;
			}
			if (permission === 'denied') {
				setState({
					kind: 'failed',
					error: { type: 'permission-denied', message: 'User denied location permission' },
					lastKnown: latestPosition,
				});
				return;
			}
			beginAcquisition();
		});
	};

	const stop = (): void => {
		clearWatch();
		latestPosition = null;
		setState({ kind: 'idle' });
	};

	const onVisibilityChange = (): void => {
		if (deps.visibility.hidden) {
			if (state.kind === 'acquiring' || state.kind === 'tracking') {
				clearWatch();
				setState({ kind: 'paused', lastKnown: latestPosition });
			}
			return;
		}
		if (state.kind === 'paused') {
			start();
		}
	};

	deps.visibility.addEventListener('visibilitychange', onVisibilityChange);

	return {
		state: () => state,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		start,
		stop,
	};
}
