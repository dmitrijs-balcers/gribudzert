import type { DurationMs, NoticeId, NoticeState, Timestamp } from '../../domain';

/**
 * Everything the notice centre needs from the outside world. Timers and rendering are
 * injected so the runtime can be driven in tests with fake clocks and no DOM.
 */
export type NoticePorts = {
	readonly now: () => Timestamp;
	readonly nextId: () => NoticeId;
	readonly render: (state: NoticeState) => void;
	/** Arrange for `fire` to run after `after`; a later call with the same id replaces it. */
	readonly schedule: (id: NoticeId, after: DurationMs, fire: () => void) => void;
	readonly cancel: (id: NoticeId) => void;
};
