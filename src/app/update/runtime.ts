import type { AppUpdateEffect, AppUpdateEvent, AppUpdateState } from '../../domain';
import { applyAppUpdate, initialAppUpdateState } from '../../domain';
import type { AppUpdatePorts } from './ports';

export type AppUpdateRuntime = {
	readonly dispatch: (event: AppUpdateEvent) => void;
};

export const createAppUpdateRuntime = (ports: AppUpdatePorts): AppUpdateRuntime => {
	let state: AppUpdateState = initialAppUpdateState;

	const runEffect = (effect: AppUpdateEffect): void => {
		switch (effect.kind) {
			case 'show-update-ready':
				ports.showUpdateReady();
				return;
			case 'activate-waiting-worker':
				ports.activateWaiting();
				return;
			case 'reload':
				ports.reload();
				return;
			default: {
				const exhaustive: never = effect;
				throw new Error(`Unhandled app update effect: ${JSON.stringify(exhaustive)}`);
			}
		}
	};

	const dispatch = (event: AppUpdateEvent): void => {
		const [nextState, effects] = applyAppUpdate(state, event);
		state = nextState;
		for (const effect of effects) {
			runEffect(effect);
		}
	};

	return { dispatch };
};
