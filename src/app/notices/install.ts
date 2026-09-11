import type { Timestamp } from '../../domain';
import { createNoticeView } from '../../ui/notices';
import { createNoticeCenter, type NoticeCenter } from './runtime';
import { createNoticeTimers, createSequentialNoticeIds } from './timers';

export type InstalledNoticeCenter = {
	readonly center: NoticeCenter;
	readonly destroy: () => void;
};

export const installNoticeCenter = (
	host: HTMLElement,
	now: () => Timestamp
): InstalledNoticeCenter => {
	const view = createNoticeView(host, {
		onDismiss: (id) => center.dismiss(id),
		onSelect: (id) => center.select(id),
		onHold: () => center.hold(),
		onRelease: () => center.release(),
	});

	const { schedule, cancel } = createNoticeTimers();
	const center: NoticeCenter = createNoticeCenter({
		now,
		nextId: createSequentialNoticeIds(),
		render: view.render,
		schedule,
		cancel,
	});

	return {
		center,
		destroy: () => view.destroy(),
	};
};
