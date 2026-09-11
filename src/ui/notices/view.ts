import type { NoticeId, NoticeState } from '../../domain';

export type NoticeViewHandlers = {
	readonly onDismiss: (id: NoticeId) => void;
	readonly onSelect: (id: NoticeId) => void;
	readonly onHold: () => void;
	readonly onRelease: () => void;
};

export type NoticeView = {
	readonly render: (state: NoticeState) => void;
	readonly destroy: () => void;
};
