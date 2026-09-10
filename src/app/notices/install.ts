import type { Timestamp } from '../../domain';
import { createNoticeView } from '../../ui/notices';
import { createNoticeCenter, type NoticeCenter } from './runtime';
import { createNoticeTimers, createSequentialNoticeIds } from './timers';

export type InstalledNoticeCenter = {
	readonly center: NoticeCenter;
	readonly destroy: () => void;
};

/**
 * Composition root: wires the DOM notice view to the pure notice centre with real timers
 * and sequential ids, and connects the view's dismiss/select/hold/release callbacks back
 * into the centre. This is the one place the rest of the app needs to know about to get
 * a working `NoticeCenter`.
 */
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
