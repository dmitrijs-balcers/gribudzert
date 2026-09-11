import type { DurationMs, NoticeId } from '../../domain';
import type { NoticePorts } from './ports';

export const createNoticeTimers = (): Pick<NoticePorts, 'schedule' | 'cancel'> => {
	const timers = new Map<NoticeId, ReturnType<typeof setTimeout>>();
	const cancel = (id: NoticeId): void => {
		const timer = timers.get(id);
		if (timer !== undefined) {
			clearTimeout(timer);
			timers.delete(id);
		}
	};
	const schedule = (id: NoticeId, after: DurationMs, fire: () => void): void => {
		cancel(id);
		timers.set(
			id,
			setTimeout(() => {
				timers.delete(id);
				fire();
			}, after)
		);
	};
	return { schedule, cancel };
};

export const createSequentialNoticeIds = (): NoticePorts['nextId'] => {
	let counter = 0;
	return () => {
		counter += 1;
		return `notice-${counter}` as NoticeId;
	};
};
