import type {
	CardRequest,
	NoticeAction,
	NoticeEffect,
	NoticeEvent,
	NoticeId,
	NoticeRequest,
	NoticeState,
	NoticeTone,
} from '../../domain';
import { applyNotice, initialNoticeState } from '../../domain';
import type { NoticePorts } from './ports';

export type CardAction = NoticeAction & {
	readonly onSelect: () => void;
};

export type NoticeCenter = {
	readonly toast: (message: string, tone?: NoticeTone) => NoticeId;
	readonly status: (message: string, tone?: NoticeTone) => NoticeId;
	readonly clearStatus: () => void;
	readonly card: (message: string, action: CardAction | null, tone?: NoticeTone) => NoticeId;
	readonly announce: (request: NoticeRequest) => NoticeId;
	readonly dismiss: (id: NoticeId) => void;
	readonly select: (id: NoticeId) => void;
	readonly hold: () => void;
	readonly release: () => void;
	readonly state: () => NoticeState;
};

const visibleProjectionChanged = (previous: NoticeState, next: NoticeState): boolean =>
	next.toasts !== previous.toasts || next.status !== previous.status || next.card !== previous.card;

export const createNoticeCenter = (ports: NoticePorts): NoticeCenter => {
	let state: NoticeState = initialNoticeState;
	const actions = new Map<NoticeId, () => void>();

	const runEffect = (effect: NoticeEffect): void => {
		switch (effect.kind) {
			case 'schedule-expiry':
				ports.schedule(effect.id, effect.after, () =>
					dispatch({ kind: 'dismissed', id: effect.id })
				);
				return;
			case 'cancel-expiry':
				ports.cancel(effect.id);
				return;
			default: {
				const exhaustive: never = effect;
				throw new Error(`Unhandled notice effect: ${JSON.stringify(exhaustive)}`);
			}
		}
	};

	const forgetDroppedActions = (): void => {
		for (const id of actions.keys()) {
			if (state.card?.id !== id) {
				actions.delete(id);
			}
		}
	};

	const dispatch = (event: NoticeEvent): void => {
		const previous = state;
		const [nextState, effects] = applyNotice(state, event, ports.now());
		state = nextState;
		for (const effect of effects) {
			runEffect(effect);
		}
		forgetDroppedActions();
		if (visibleProjectionChanged(previous, nextState)) {
			ports.render(state);
		}
	};

	const announce = (request: NoticeRequest): NoticeId => {
		const id = ports.nextId();
		dispatch({ kind: 'announced', id, request });
		return id;
	};

	const card = (
		message: string,
		action: CardAction | null,
		tone: NoticeTone = 'neutral'
	): NoticeId => {
		const request: CardRequest = {
			kind: 'card',
			message,
			tone,
			action: action === null ? null : { label: action.label },
		};
		const id = ports.nextId();
		if (action !== null) {
			actions.set(id, action.onSelect);
		}
		dispatch({ kind: 'announced', id, request });
		return id;
	};

	return {
		toast: (message, tone = 'neutral') => announce({ kind: 'toast', message, tone }),
		status: (message, tone = 'neutral') => announce({ kind: 'status', message, tone }),
		clearStatus: () => dispatch({ kind: 'status-cleared' }),
		card,
		announce,
		dismiss: (id) => dispatch({ kind: 'dismissed', id }),
		select: (id) => {
			const handler = actions.get(id);
			dispatch({ kind: 'dismissed', id });
			handler?.();
		},
		hold: () => dispatch({ kind: 'held' }),
		release: () => dispatch({ kind: 'released' }),
		state: () => state,
	};
};
