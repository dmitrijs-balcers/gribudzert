/**
 * State machine for the "new version ready" flow.
 *
 * A service worker install is only ever an *update* once a previous worker has already
 * claimed the page — `controllerchange` also fires on the very first install (the worker
 * calls `clients.claim()`), and that must never trigger a reload. Reload only ever
 * follows a `reload-requested` event the user caused by pressing the toast's action.
 */

export type AppUpdatePhase = 'current' | 'update-ready' | 'activating';

export type AppUpdateState = {
	readonly phase: AppUpdatePhase;
	readonly toastShown: boolean;
};

export type AppUpdateEvent =
	| { readonly kind: 'update-waiting' }
	| { readonly kind: 'reload-requested' }
	| { readonly kind: 'controller-changed' };

export type AppUpdateEffect =
	| { readonly kind: 'show-update-ready' }
	| { readonly kind: 'activate-waiting-worker' }
	| { readonly kind: 'reload' };

export const initialAppUpdateState: AppUpdateState = { phase: 'current', toastShown: false };

const handleUpdateWaiting = (
	state: AppUpdateState
): readonly [AppUpdateState, readonly AppUpdateEffect[]] => {
	if (state.toastShown) {
		return [state, []];
	}
	return [{ phase: 'update-ready', toastShown: true }, [{ kind: 'show-update-ready' }]];
};

const handleReloadRequested = (
	state: AppUpdateState
): readonly [AppUpdateState, readonly AppUpdateEffect[]] => {
	if (state.phase !== 'update-ready') {
		return [state, []];
	}
	return [{ ...state, phase: 'activating' }, [{ kind: 'activate-waiting-worker' }]];
};

const handleControllerChanged = (
	state: AppUpdateState
): readonly [AppUpdateState, readonly AppUpdateEffect[]] => {
	if (state.phase !== 'activating') {
		return [state, []];
	}
	return [state, [{ kind: 'reload' }]];
};

export const applyAppUpdate = (
	state: AppUpdateState,
	event: AppUpdateEvent
): readonly [AppUpdateState, readonly AppUpdateEffect[]] => {
	switch (event.kind) {
		case 'update-waiting':
			return handleUpdateWaiting(state);
		case 'reload-requested':
			return handleReloadRequested(state);
		case 'controller-changed':
			return handleControllerChanged(state);
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
};
