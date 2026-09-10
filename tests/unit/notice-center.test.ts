/**
 * The notice centre runtime (`createNoticeCenter`) and its real-world ports
 * (`createNoticeTimers`, `createSequentialNoticeIds`).
 *
 * The reducer's own rules are covered in notice.test.ts; here we only check that the
 * runtime wires ports correctly: ids come from `nextId`, timing from `now`/`schedule`/
 * `cancel`, rendering happens exactly when state changes, and card actions run once.
 */

import { describe, expect, it, vi } from 'vitest';
import type { NoticePorts } from '../../src/app/notices/ports';
import { createNoticeCenter } from '../../src/app/notices/runtime';
import { createNoticeTimers, createSequentialNoticeIds } from '../../src/app/notices/timers';
import type { DurationMs, NoticeId, NoticeState, Timestamp } from '../../src/domain';
import { durationMs, noticeId, timestamp } from '../../src/domain';

const at = (n: number): Timestamp => {
	const t = timestamp(n);
	if (t === null) {
		throw new Error(`Invalid timestamp for a test fixture: ${n}`);
	}
	return t;
};

const dur = (n: number): DurationMs => {
	const d = durationMs(n);
	if (d === null) {
		throw new Error(`Invalid duration for a test fixture: ${n}`);
	}
	return d;
};

type ScheduleCall = { readonly id: NoticeId; readonly after: DurationMs };

/** Fake ports: a controllable clock, sequential ids, a spy render, and recorded timers. */
const createFakePorts = () => {
	let currentTime = 0;
	const pending = new Map<NoticeId, () => void>();
	const scheduleCalls: ScheduleCall[] = [];
	const cancelCalls: NoticeId[] = [];
	let counter = 0;
	const render = vi.fn();

	const ports: NoticePorts = {
		now: () => at(currentTime),
		nextId: () => {
			counter += 1;
			return noticeId(`n${counter}`);
		},
		render,
		schedule: (id, after, fire) => {
			pending.set(id, fire);
			scheduleCalls.push({ id, after });
		},
		cancel: (id) => {
			pending.delete(id);
			cancelCalls.push(id);
		},
	};

	return {
		ports,
		render,
		scheduleCalls,
		cancelCalls,
		setNow: (n: number): void => {
			currentTime = n;
		},
		isPending: (id: NoticeId): boolean => pending.has(id),
		fire: (id: NoticeId): void => {
			const callback = pending.get(id);
			if (callback === undefined) {
				throw new Error(`No timer is pending for ${id}`);
			}
			pending.delete(id);
			callback();
		},
	};
};

describe('createNoticeCenter: toast', () => {
	it('returns an id, renders once, schedules expiry, and dismisses+renders again when it fires', () => {
		const fake = createFakePorts();
		const center = createNoticeCenter(fake.ports);

		const id = center.toast('Hello there');

		expect(id).toBe(noticeId('n1'));
		expect(fake.render).toHaveBeenCalledTimes(1);
		expect(fake.isPending(id)).toBe(true);

		fake.fire(id);

		expect(center.state().toasts).toEqual([]);
		expect(fake.render).toHaveBeenCalledTimes(2);
	});
});

describe('createNoticeCenter: render only on change', () => {
	it('does not render when dismissing an unknown id', () => {
		const fake = createFakePorts();
		const center = createNoticeCenter(fake.ports);

		center.dismiss(noticeId('does-not-exist'));

		expect(fake.render).not.toHaveBeenCalled();
	});

	it('does not render when clearing a status that is not set', () => {
		const fake = createFakePorts();
		const center = createNoticeCenter(fake.ports);

		center.clearStatus();

		expect(fake.render).not.toHaveBeenCalled();
	});
});

describe('createNoticeCenter: card', () => {
	it('select() runs the action exactly once and dismisses the card', () => {
		const fake = createFakePorts();
		const center = createNoticeCenter(fake.ports);
		const onSelect = vi.fn();

		const id = center.card('A new version is ready.', { label: 'Reload', onSelect });
		center.select(id);

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(center.state().card).toBeNull();
	});

	it('select() on a toast id just dismisses it, running no handler', () => {
		const fake = createFakePorts();
		const center = createNoticeCenter(fake.ports);

		const id = center.toast('Just a toast');
		center.select(id);

		expect(center.state().toasts).toEqual([]);
	});

	it('does nothing when select() is called again once the card is gone', () => {
		const fake = createFakePorts();
		const center = createNoticeCenter(fake.ports);
		const onSelect = vi.fn();

		const id = center.card('A new version is ready.', { label: 'Reload', onSelect });
		center.select(id);
		center.select(id);

		expect(onSelect).toHaveBeenCalledTimes(1);
	});

	it('a second card() forgets the first card action: selecting the old id runs nothing', () => {
		const fake = createFakePorts();
		const center = createNoticeCenter(fake.ports);
		const firstSelect = vi.fn();
		const secondSelect = vi.fn();

		const firstId = center.card('First card', { label: 'Go', onSelect: firstSelect });
		center.card('Second card', { label: 'Go', onSelect: secondSelect });

		center.select(firstId);

		expect(firstSelect).not.toHaveBeenCalled();
		expect(secondSelect).not.toHaveBeenCalled();
		expect(center.state().card).toMatchObject({ message: 'Second card' });
	});
});

describe('createNoticeCenter: hold / release', () => {
	it('hold() cancels the pending timer; release() reschedules with the remaining time', () => {
		const fake = createFakePorts();
		const center = createNoticeCenter(fake.ports);

		const id = center.toast('Held toast');
		fake.setNow(1000);
		center.hold();

		expect(fake.cancelCalls).toContain(id);

		fake.setNow(3000);
		center.release();

		const rescheduled = fake.scheduleCalls.at(-1);
		expect(rescheduled?.id).toBe(id);
		expect(rescheduled?.after).toBe(dur(4000 + 2000 - 3000));
	});
});

describe('createNoticeCenter: announce', () => {
	it('announces a toast, a status, and a card', () => {
		const fake = createFakePorts();
		const center = createNoticeCenter(fake.ports);

		const toastId = center.announce({ kind: 'toast', message: 'A toast', tone: 'neutral' });
		const statusId = center.announce({ kind: 'status', message: 'A status', tone: 'neutral' });
		const cardId = center.announce({
			kind: 'card',
			message: 'A card',
			tone: 'neutral',
			action: null,
		});

		const state: NoticeState = center.state();
		expect(state.toasts.map((toast) => toast.id)).toContain(toastId);
		expect(state.status?.id).toBe(statusId);
		expect(state.card?.id).toBe(cardId);
	});
});

describe('createNoticeTimers', () => {
	it('fires after the given delay', () => {
		vi.useFakeTimers();
		try {
			const { schedule } = createNoticeTimers();
			const fire = vi.fn();

			schedule(noticeId('a'), dur(100), fire);
			vi.advanceTimersByTime(99);
			expect(fire).not.toHaveBeenCalled();

			vi.advanceTimersByTime(1);
			expect(fire).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it('rescheduling the same id fires only once, at the new delay', () => {
		vi.useFakeTimers();
		try {
			const { schedule } = createNoticeTimers();
			const first = vi.fn();
			const second = vi.fn();

			schedule(noticeId('a'), dur(100), first);
			schedule(noticeId('a'), dur(50), second);

			vi.advanceTimersByTime(50);
			expect(second).toHaveBeenCalledTimes(1);
			expect(first).not.toHaveBeenCalled();

			vi.advanceTimersByTime(1000);
			expect(second).toHaveBeenCalledTimes(1);
			expect(first).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it('cancel prevents the callback from firing', () => {
		vi.useFakeTimers();
		try {
			const { schedule, cancel } = createNoticeTimers();
			const fire = vi.fn();

			schedule(noticeId('a'), dur(100), fire);
			cancel(noticeId('a'));
			vi.advanceTimersByTime(1000);

			expect(fire).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('createSequentialNoticeIds', () => {
	it('produces unique, increasing ids', () => {
		const nextId = createSequentialNoticeIds();

		const ids = [nextId(), nextId(), nextId()];

		expect(new Set(ids).size).toBe(3);
		expect(ids).toEqual([noticeId('notice-1'), noticeId('notice-2'), noticeId('notice-3')]);
	});
});
