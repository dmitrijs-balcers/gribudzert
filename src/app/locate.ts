import { trackLocateFailed, trackLocateRequested, trackLocateSuccess } from '../analytics';
import type {
	FollowController,
	FollowMode,
	LocationTracker,
	TrackingState,
} from '../features/location';
import { toLocationFailureCategory } from '../types/errors';
import type { LocateButtonView } from '../ui/locate-control';
import { locationErrorMessage } from './messages';
import type { NoticeCenter } from './notices';

export type SettledTrackingState = Extract<TrackingState, { kind: 'tracking' | 'failed' }>;

export const locateButtonViewOf = (state: TrackingState, follow: FollowMode): LocateButtonView => {
	switch (state.kind) {
		case 'idle':
			return { kind: 'idle' };
		case 'acquiring':
			return { kind: 'acquiring' };
		case 'tracking':
			return { kind: 'tracking', follow };
		case 'paused':
			return state.lastKnown === null ? { kind: 'acquiring' } : { kind: 'tracking', follow };
		case 'failed':
			return state.error.type === 'permission-denied' ? { kind: 'blocked' } : { kind: 'failed' };
		default: {
			const exhaustive: never = state;
			return exhaustive;
		}
	}
};

export const onceSettled = (
	tracker: LocationTracker,
	onSettled: (state: SettledTrackingState) => void
): void => {
	const stop = tracker.subscribe((state) => {
		if (state.kind !== 'tracking' && state.kind !== 'failed') {
			return;
		}
		stop();
		onSettled(state);
	});
};

const reportPressOutcome = (tracker: LocationTracker, notices: NoticeCenter): void => {
	onceSettled(tracker, (state) => {
		if (state.kind === 'tracking') {
			trackLocateSuccess();
			return;
		}
		trackLocateFailed(toLocationFailureCategory(state.error));
		notices.toast(locationErrorMessage(state.error), 'error');
	});
};

export const onLocateActivate = (
	tracker: LocationTracker,
	followController: FollowController,
	notices: NoticeCenter
): void => {
	trackLocateRequested();
	const state = tracker.state();
	switch (state.kind) {
		case 'idle':
		case 'failed':
			reportPressOutcome(tracker, notices);
			tracker.start();
			followController.follow('flyTo');
			return;
		case 'paused':
			tracker.start();
			return;
		case 'acquiring':
			return;
		case 'tracking':
			if (followController.mode() === 'on') {
				followController.unfollow();
			} else {
				followController.follow('flyTo');
			}
			return;
		default: {
			const exhaustive: never = state;
			throw new Error(`Unhandled tracking state: ${JSON.stringify(exhaustive)}`);
		}
	}
};
