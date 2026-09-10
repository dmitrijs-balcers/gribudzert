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

/** A card action as callers see it: a label plus what to do when it is chosen. */
export type CardAction = NoticeAction & {
	readonly onSelect: () => void;
};

/**
 * The one door through which the rest of the app talks to the user. Callers say what kind
 * of notice they need and never think about timing, stacking, or the DOM.
 */
export type NoticeCenter = {
	readonly toast: (message: string, tone?: NoticeTone) => NoticeId;
	readonly status: (message: string, tone?: NoticeTone) => NoticeId;
	readonly clearStatus: () => void;
	readonly card: (message: string, action: CardAction | null, tone?: NoticeTone) => NoticeId;
	readonly announce: (request: NoticeRequest) => NoticeId;
	readonly dismiss: (id: NoticeId) => void;
	/** The user chose the card's action. Runs the handler, then dismisses the card. */
	readonly select: (id: NoticeId) => void;
	/** Stop toasts from ageing (finger on the stack, tab hidden). */
	readonly hold: () => void;
	readonly release: () => void;
	readonly state: () => NoticeState;
};

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
		const [nextState, effects] = applyNotice(state, event, ports.now());
		const changed = nextState !== state;
		state = nextState;
		for (const effect of effects) {
			runEffect(effect);
		}
		forgetDroppedActions();
		if (changed) {
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
