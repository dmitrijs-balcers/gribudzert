import type { DurationMs, Timestamp } from './units';

export type NoticeId = string & { readonly __brand: 'NoticeId' };

export const noticeId = (value: string): NoticeId => value as NoticeId;

export type NoticeTone = 'neutral' | 'success' | 'warning' | 'error';

export type NoticeAction = {
	readonly label: string;
};

export type ToastRequest = {
	readonly kind: 'toast';
	readonly message: string;
	readonly tone: NoticeTone;
};

export type StatusRequest = {
	readonly kind: 'status';
	readonly message: string;
	readonly tone: NoticeTone;
};

export type CardRequest = {
	readonly kind: 'card';
	readonly message: string;
	readonly tone: NoticeTone;
	readonly action: NoticeAction | null;
};

export type NoticeRequest = ToastRequest | StatusRequest | CardRequest;

export type Toast = ToastRequest & {
	readonly id: NoticeId;
	readonly expiresAt: Timestamp;
};

export type Status = StatusRequest & {
	readonly id: NoticeId;
};

export type Card = CardRequest & {
	readonly id: NoticeId;
};

export type Notice = Toast | Status | Card;

export type NoticeState = {
	readonly toasts: readonly Toast[];
	readonly status: Status | null;
	readonly card: Card | null;
	readonly heldSince: Timestamp | null;
};

export type NoticeEvent =
	| { readonly kind: 'announced'; readonly id: NoticeId; readonly request: NoticeRequest }
	| { readonly kind: 'dismissed'; readonly id: NoticeId }
	| { readonly kind: 'status-cleared' }
	| { readonly kind: 'held' }
	| { readonly kind: 'released' };

export type NoticeEffect =
	| { readonly kind: 'schedule-expiry'; readonly id: NoticeId; readonly after: DurationMs }
	| { readonly kind: 'cancel-expiry'; readonly id: NoticeId };

export const MAX_VISIBLE_TOASTS = 3;

const MIN_TOAST_LIFETIME_MS = 4000;
const MAX_TOAST_LIFETIME_MS = 7000;
const COMFORTABLE_TOAST_LENGTH = 40;
const EXTRA_MS_PER_CHARACTER = 60;

export const initialNoticeState: NoticeState = {
	toasts: [],
	status: null,
	card: null,
	heldSince: null,
};

export const toastLifetime = (message: string): DurationMs => {
	const extra = Math.max(0, message.trim().length - COMFORTABLE_TOAST_LENGTH);
	const lifetime = Math.min(
		MAX_TOAST_LIFETIME_MS,
		MIN_TOAST_LIFETIME_MS + extra * EXTRA_MS_PER_CHARACTER
	);
	return lifetime as DurationMs;
};

const remainingLifetime = (toast: Toast, now: Timestamp): DurationMs =>
	Math.max(0, toast.expiresAt - now) as DurationMs;

const cancelExpiryOf = (toasts: readonly Toast[]): readonly NoticeEffect[] =>
	toasts.map((toast) => ({ kind: 'cancel-expiry', id: toast.id }));

type Transition = readonly [NoticeState, readonly NoticeEffect[]];

const duplicatesOf = (toasts: readonly Toast[], message: string): readonly Toast[] =>
	toasts.filter((toast) => toast.message === message);

const dropDuplicateToasts = (toasts: readonly Toast[], message: string): readonly Toast[] =>
	toasts.filter((toast) => toast.message !== message);

const overflowBeyondVisibleCap = (toasts: readonly Toast[]): readonly Toast[] =>
	toasts.slice(MAX_VISIBLE_TOASTS - 1);

const dropOverflowToasts = (toasts: readonly Toast[]): readonly Toast[] =>
	toasts.slice(0, MAX_VISIBLE_TOASTS - 1);

const announceToast = (
	state: NoticeState,
	id: NoticeId,
	request: ToastRequest,
	now: Timestamp
): Transition => {
	const duplicates = duplicatesOf(state.toasts, request.message);
	const kept = dropDuplicateToasts(state.toasts, request.message);
	const overflow = overflowBeyondVisibleCap(kept);
	const survivors = dropOverflowToasts(kept);

	const lifetime = toastLifetime(request.message);
	const toast: Toast = { ...request, id, expiresAt: (now + lifetime) as Timestamp };
	const effects: NoticeEffect[] = [...cancelExpiryOf(duplicates), ...cancelExpiryOf(overflow)];
	if (state.heldSince === null) {
		effects.push({ kind: 'schedule-expiry', id, after: lifetime });
	}
	return [{ ...state, toasts: [toast, ...survivors] }, effects];
};

const announceStatus = (state: NoticeState, id: NoticeId, request: StatusRequest): Transition => [
	{ ...state, status: { ...request, id } },
	[],
];

const announceCard = (state: NoticeState, id: NoticeId, request: CardRequest): Transition => [
	{ ...state, card: { ...request, id } },
	[],
];

const handleAnnounced = (
	state: NoticeState,
	event: Extract<NoticeEvent, { readonly kind: 'announced' }>,
	now: Timestamp
): Transition => {
	const { request } = event;
	switch (request.kind) {
		case 'toast':
			return announceToast(state, event.id, request, now);
		case 'status':
			return announceStatus(state, event.id, request);
		case 'card':
			return announceCard(state, event.id, request);
		default: {
			const exhaustive: never = request;
			return exhaustive;
		}
	}
};

const handleDismissed = (state: NoticeState, id: NoticeId): Transition => {
	const toast = state.toasts.find((candidate) => candidate.id === id);
	if (toast !== undefined) {
		return [
			{ ...state, toasts: state.toasts.filter((candidate) => candidate.id !== id) },
			[{ kind: 'cancel-expiry', id }],
		];
	}
	if (state.status?.id === id) {
		return [{ ...state, status: null }, []];
	}
	if (state.card?.id === id) {
		return [{ ...state, card: null }, []];
	}
	return [state, []];
};

const handleStatusCleared = (state: NoticeState): Transition =>
	state.status === null ? [state, []] : [{ ...state, status: null }, []];

const handleHeld = (state: NoticeState, now: Timestamp): Transition => {
	if (state.heldSince !== null) {
		return [state, []];
	}
	return [{ ...state, heldSince: now }, cancelExpiryOf(state.toasts)];
};

const handleReleased = (state: NoticeState, now: Timestamp): Transition => {
	if (state.heldSince === null) {
		return [state, []];
	}
	const heldFor = now - state.heldSince;
	const toasts = state.toasts.map((toast) => ({
		...toast,
		expiresAt: (toast.expiresAt + heldFor) as Timestamp,
	}));
	const effects: readonly NoticeEffect[] = toasts.map((toast) => ({
		kind: 'schedule-expiry',
		id: toast.id,
		after: remainingLifetime(toast, now),
	}));
	return [{ ...state, toasts, heldSince: null }, effects];
};

export const applyNotice = (state: NoticeState, event: NoticeEvent, now: Timestamp): Transition => {
	switch (event.kind) {
		case 'announced':
			return handleAnnounced(state, event, now);
		case 'dismissed':
			return handleDismissed(state, event.id);
		case 'status-cleared':
			return handleStatusCleared(state);
		case 'held':
			return handleHeld(state, now);
		case 'released':
			return handleReleased(state, now);
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
};

export const visibleNotices = (state: NoticeState): readonly Notice[] => [
	...(state.status === null ? [] : [state.status]),
	...state.toasts,
	...(state.card === null ? [] : [state.card]),
];
