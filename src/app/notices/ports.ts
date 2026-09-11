import type { DurationMs, NoticeId, NoticeState, Timestamp } from '../../domain';

export type NoticePorts = {
	readonly now: () => Timestamp;
	readonly nextId: () => NoticeId;
	readonly render: (state: NoticeState) => void;
	readonly schedule: (id: NoticeId, after: DurationMs, fire: () => void) => void;
	readonly cancel: (id: NoticeId) => void;
};
