/**
 * The pure notice reducer: `applyNotice`, `toastLifetime` and `visibleNotices`.
 *
 * No ports, no timers, no DOM — every case here is state in, [state, effects] out.
 */

import { describe, expect, it } from 'vitest';
import type {
	Notice,
	NoticeEvent,
	NoticeId,
	NoticeRequest,
	NoticeState,
	NoticeTone,
	Timestamp,
} from '../../src/domain';
import {
	applyNotice,
	initialNoticeState,
	MAX_VISIBLE_TOASTS,
	noticeId,
	timestamp,
	toastLifetime,
	visibleNotices,
} from '../../src/domain';

/** `timestamp` returns `Timestamp | null`; every value used in these tests is valid. */
const at = (n: number): Timestamp => {
	const t = timestamp(n);
	if (t === null) {
		throw new Error(`Invalid timestamp for a test fixture: ${n}`);
	}
	return t;
};

const announced = (id: string, request: NoticeRequest): NoticeEvent => ({
	kind: 'announced',
	id: noticeId(id),
	request,
});

const toastRequest = (message: string, tone: NoticeTone = 'neutral') =>
	({ kind: 'toast', message, tone }) as const;

const statusRequest = (message: string, tone: NoticeTone = 'neutral') =>
	({ kind: 'status', message, tone }) as const;

const cardRequest = (message: string, tone: NoticeTone = 'neutral') =>
	({ kind: 'card', message, tone, action: null }) as const;

const announceToast = (id: string, message: string, tone: NoticeTone = 'neutral'): NoticeEvent =>
	announced(id, toastRequest(message, tone));

const announceStatus = (id: string, message: string, tone: NoticeTone = 'neutral'): NoticeEvent =>
	announced(id, statusRequest(message, tone));

const announceCard = (id: string, message: string, tone: NoticeTone = 'neutral'): NoticeEvent =>
	announced(id, cardRequest(message, tone));

const dismissed = (id: string): NoticeEvent => ({ kind: 'dismissed', id: noticeId(id) });

/** Fold a list of (event, now) pairs onto `initialNoticeState`, keeping only the final state. */
const run = (
	state: NoticeState,
	steps: ReadonlyArray<readonly [NoticeEvent, number]>
): NoticeState =>
	steps.reduce((current, [event, now]) => applyNotice(current, event, at(now))[0], state);

const idsOf = (notices: readonly { readonly id: NoticeId }[]): readonly NoticeId[] =>
	notices.map((notice) => notice.id);

describe('toastLifetime', () => {
	it.each<[string, string, number]>([
		['an empty message', '', 4000],
		['a short message', 'Back online.', 4000],
		['exactly the comfortable length (40 chars)', 'a'.repeat(40), 4000],
		['one character past comfortable', 'a'.repeat(41), 4060],
		['ten characters past comfortable', 'a'.repeat(50), 4600],
		['long enough to hit the cap', 'a'.repeat(90), 7000],
		['far past the cap', 'a'.repeat(500), 7000],
	])('%s -> %dms', (_label, message, expected) => {
		expect(toastLifetime(message)).toBe(expected);
	});

	it('trims whitespace before measuring length', () => {
		const padded = `   ${'a'.repeat(40)}   `;
		expect(toastLifetime(padded)).toBe(toastLifetime('a'.repeat(40)));
		expect(toastLifetime(padded)).toBe(4000);
	});
});

describe('applyNotice: announcing a toast', () => {
	it('puts the toast first, sets expiresAt to now + lifetime, and schedules its expiry', () => {
		const [state, effects] = applyNotice(
			initialNoticeState,
			announceToast('t1', 'Hello there'),
			at(1000)
		);

		expect(state.toasts).toHaveLength(1);
		expect(state.toasts[0]).toMatchObject({
			id: noticeId('t1'),
			message: 'Hello there',
			expiresAt: at(1000 + toastLifetime('Hello there')),
		});
		expect(effects).toEqual([
			{ kind: 'schedule-expiry', id: noticeId('t1'), after: toastLifetime('Hello there') },
		]);
	});

	it('drops the oldest toast once a fourth arrives, and never exceeds MAX_VISIBLE_TOASTS', () => {
		const afterThree = run(initialNoticeState, [
			[announceToast('t1', 'First'), 0],
			[announceToast('t2', 'Second'), 0],
			[announceToast('t3', 'Third'), 0],
		]);
		expect(afterThree.toasts).toHaveLength(MAX_VISIBLE_TOASTS);

		const [state, effects] = applyNotice(afterThree, announceToast('t4', 'Fourth'), at(0));

		expect(state.toasts).toHaveLength(MAX_VISIBLE_TOASTS);
		expect(idsOf(state.toasts)).toEqual([noticeId('t4'), noticeId('t3'), noticeId('t2')]);
		expect(effects).toContainEqual({ kind: 'cancel-expiry', id: noticeId('t1') });
	});

	it('replaces a visible toast with the same message: old id gone, cancel-expiry for it, new one in front', () => {
		const withTwo = run(initialNoticeState, [
			[announceToast('t1', 'Same text'), 0],
			[announceToast('t2', 'Other text'), 0],
		]);

		const [state, effects] = applyNotice(withTwo, announceToast('t3', 'Same text'), at(0));

		expect(idsOf(state.toasts)).toEqual([noticeId('t3'), noticeId('t2')]);
		expect(effects).toContainEqual({ kind: 'cancel-expiry', id: noticeId('t1') });
	});
});

describe('applyNotice: dismissed', () => {
	it('removes a toast and emits cancel-expiry for it', () => {
		const withToast = applyNotice(initialNoticeState, announceToast('t1', 'Bye soon'), at(0))[0];

		const [state, effects] = applyNotice(withToast, dismissed('t1'), at(500));

		expect(state.toasts).toEqual([]);
		expect(effects).toEqual([{ kind: 'cancel-expiry', id: noticeId('t1') }]);
	});

	it('is a no-op for an unknown id, returning the very same state object', () => {
		const withToast = applyNotice(initialNoticeState, announceToast('t1', 'Still here'), at(0))[0];

		const [state, effects] = applyNotice(withToast, dismissed('unknown'), at(0));

		expect(state).toBe(withToast);
		expect(effects).toEqual([]);
	});

	it('clears the status by id, with no effects', () => {
		const withStatus = applyNotice(initialNoticeState, announceStatus('s1', 'Offline'), at(0))[0];

		const [state, effects] = applyNotice(withStatus, dismissed('s1'), at(0));

		expect(state.status).toBeNull();
		expect(effects).toEqual([]);
	});

	it('clears the card by id, with no effects', () => {
		const withCard = applyNotice(initialNoticeState, announceCard('c1', 'Update ready'), at(0))[0];

		const [state, effects] = applyNotice(withCard, dismissed('c1'), at(0));

		expect(state.card).toBeNull();
		expect(effects).toEqual([]);
	});
});

describe('applyNotice: status', () => {
	it('replaces any existing status', () => {
		const withFirst = applyNotice(initialNoticeState, announceStatus('s1', 'Offline'), at(0))[0];

		const [state] = applyNotice(withFirst, announceStatus('s2', 'Reconnecting'), at(0));

		expect(state.status).toMatchObject({ id: noticeId('s2'), message: 'Reconnecting' });
	});

	it('status-cleared on an already-empty state is a no-op, returning the same object', () => {
		const [state, effects] = applyNotice(initialNoticeState, { kind: 'status-cleared' }, at(0));

		expect(state).toBe(initialNoticeState);
		expect(effects).toEqual([]);
	});
});

describe('applyNotice: card', () => {
	it('replaces an existing card', () => {
		const withFirst = applyNotice(initialNoticeState, announceCard('c1', 'First card'), at(0))[0];

		const [state] = applyNotice(withFirst, announceCard('c2', 'Second card'), at(0));

		expect(state.card).toMatchObject({ id: noticeId('c2'), message: 'Second card' });
	});
});

describe('applyNotice: held / released', () => {
	it('held records heldSince and emits cancel-expiry for every toast', () => {
		const withToasts = run(initialNoticeState, [
			[announceToast('t1', 'One'), 0],
			[announceToast('t2', 'Two'), 0],
		]);

		const [state, effects] = applyNotice(withToasts, { kind: 'held' }, at(1000));

		expect(state.heldSince).toBe(at(1000));
		expect(effects).toHaveLength(2);
		expect(effects).toContainEqual({ kind: 'cancel-expiry', id: noticeId('t1') });
		expect(effects).toContainEqual({ kind: 'cancel-expiry', id: noticeId('t2') });
	});

	it('a second held is a no-op, returning the same state object', () => {
		const held = applyNotice(initialNoticeState, { kind: 'held' }, at(1000))[0];

		const [state, effects] = applyNotice(held, { kind: 'held' }, at(2000));

		expect(state).toBe(held);
		expect(effects).toEqual([]);
	});

	it('a toast announced while held gets no schedule-expiry', () => {
		const held = applyNotice(initialNoticeState, { kind: 'held' }, at(0))[0];

		const [, effects] = applyNotice(held, announceToast('t1', 'Quiet toast'), at(0));

		expect(effects).toEqual([]);
	});

	it('released shifts every expiresAt by the hold duration and schedules the remaining time', () => {
		const withToast = applyNotice(initialNoticeState, announceToast('t1', 'Timed'), at(0))[0];
		const lifetime = toastLifetime('Timed');
		const held = applyNotice(withToast, { kind: 'held' }, at(1000))[0];

		const [state, effects] = applyNotice(held, { kind: 'released' }, at(3000));

		expect(state.heldSince).toBeNull();
		expect(state.toasts[0]?.expiresAt).toBe(at(lifetime + 2000));
		expect(effects).toEqual([{ kind: 'schedule-expiry', id: noticeId('t1'), after: 3000 }]);
	});

	it('released when not held is a no-op, returning the same state object', () => {
		const [state, effects] = applyNotice(initialNoticeState, { kind: 'released' }, at(0));

		expect(state).toBe(initialNoticeState);
		expect(effects).toEqual([]);
	});
});

describe('visibleNotices', () => {
	it('orders status, then toasts newest first, then card', () => {
		const state = run(initialNoticeState, [
			[announceStatus('s1', 'Offline'), 0],
			[announceToast('t1', 'First'), 0],
			[announceToast('t2', 'Second'), 0],
			[announceCard('c1', 'Update ready'), 0],
		]);

		const notices: readonly Notice[] = visibleNotices(state);

		expect(idsOf(notices)).toEqual([
			noticeId('s1'),
			noticeId('t2'),
			noticeId('t1'),
			noticeId('c1'),
		]);
	});
});

describe('applyNotice: exhaustiveness', () => {
	it('handles every kind of event without throwing', () => {
		const events: readonly NoticeEvent[] = [
			announceToast('t1', 'A toast'),
			announceStatus('s1', 'A status'),
			announceCard('c1', 'A card'),
			dismissed('t1'),
			{ kind: 'status-cleared' },
			{ kind: 'held' },
			{ kind: 'released' },
		];

		let state = initialNoticeState;
		for (const event of events) {
			expect(() => {
				[state] = applyNotice(state, event, at(0));
			}).not.toThrow();
		}
	});
});
