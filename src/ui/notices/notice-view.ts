/**
 * DOM renderer for the notice centre: toasts + a card sit bottom centre above the
 * nearest-water HUD, a status chip sits top centre. Keyed by notice id so a notice that
 * is still present keeps its DOM node across renders — see src/domain/notice.ts for the
 * model this renders and ./view.ts for the contract implemented here.
 */
import type { Card, Notice, NoticeId, NoticeState, NoticeTone, Status, Toast } from '../../domain';
import { visibleNotices } from '../../domain';
import { toneIcon } from './icons';
import type { NoticeView, NoticeViewHandlers } from './view';
import './notices.css';

export type { NoticeView, NoticeViewHandlers } from './view';

const LEAVE_FALLBACK_MS = 300;
/** Must match the `@keyframes` name in notices.css. */
const LEAVE_ANIMATION_NAME = 'notice-fade-out';
const SWIPE_DISMISS_DISTANCE_PX = 40;
const SWIPE_DISMISS_VELOCITY_PX_PER_MS = 0.5;

export type SwipeOutcome = 'dismiss' | 'keep';

/**
 * A swipe far enough downward, or fast enough downward, dismisses the notice; anything
 * else (including an upward drag) springs back. Pure so the threshold is unit-testable
 * without simulating real pointer events.
 */
export const swipeOutcome = (deltaY: number, velocity: number): SwipeOutcome => {
	if (deltaY <= 0) {
		return 'keep';
	}
	return deltaY > SWIPE_DISMISS_DISTANCE_PX || velocity > SWIPE_DISMISS_VELOCITY_PX_PER_MS
		? 'dismiss'
		: 'keep';
};

export type StackTransform = {
	readonly translateY: number;
	readonly scale: number;
	readonly opacity: number;
	readonly zIndex: number;
};

/** How far back a toast at `depth` (0 = front, at the bottom of the stack) peeks. */
export const stackTransform = (depth: number): StackTransform => ({
	translateY: -8 * depth,
	scale: 1 - 0.06 * depth,
	opacity: 1 - 0.25 * depth,
	zIndex: 100 - depth,
});

type TrackedNotice = {
	readonly element: HTMLElement;
	readonly kind: Notice['kind'];
	leaving: boolean;
	leaveTimeout: ReturnType<typeof setTimeout> | null;
};

const roleOf = (tone: NoticeTone): 'status' | 'alert' => (tone === 'error' ? 'alert' : 'status');
const ariaLiveOf = (tone: NoticeTone): 'polite' | 'assertive' =>
	tone === 'error' ? 'assertive' : 'polite';

const dotElement = (): HTMLElement => {
	const element = document.createElement('span');
	element.className = 'notice-dot';
	element.setAttribute('aria-hidden', 'true');
	return element;
};

const iconElement = (tone: NoticeTone): HTMLElement => {
	const element = document.createElement('span');
	element.className = 'notice-icon';
	element.setAttribute('aria-hidden', 'true');
	element.innerHTML = toneIcon(tone);
	return element;
};

const messageElement = (text: string): HTMLElement => {
	const element = document.createElement('span');
	element.className = 'notice-message';
	element.textContent = text;
	return element;
};

const dismissButton = (onClick: () => void): HTMLButtonElement => {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'notice-dismiss visually-hidden';
	button.textContent = 'Dismiss';
	button.addEventListener('click', onClick);
	return button;
};

export const createNoticeView = (host: HTMLElement, handlers: NoticeViewHandlers): NoticeView => {
	const container = document.createElement('div');
	container.className = 'notice-center';
	container.setAttribute('role', 'region');
	container.setAttribute('aria-label', 'Notifications');

	const statusRegion = document.createElement('div');
	statusRegion.className = 'notice-status-region';

	const bottomRegion = document.createElement('div');
	bottomRegion.className = 'notice-bottom-region';

	const stack = document.createElement('div');
	stack.className = 'notice-stack';

	bottomRegion.appendChild(stack);
	container.append(statusRegion, bottomRegion);
	host.appendChild(container);

	const nodes = new Map<NoticeId, TrackedNotice>();
	let expanded = false;

	const applyDepth = (element: HTMLElement, depth: number): void => {
		element.dataset.depth = String(depth);
		const transform = stackTransform(depth);
		if (expanded) {
			element.style.transform = '';
			element.style.opacity = '';
		} else {
			element.style.transform = `translateY(${transform.translateY}px) scale(${transform.scale})`;
			element.style.opacity = String(transform.opacity);
		}
		element.style.zIndex = String(transform.zIndex);
	};

	const setExpanded = (value: boolean): void => {
		if (expanded === value) {
			return;
		}
		expanded = value;
		stack.classList.toggle('notice-stack-expanded', expanded);
		for (const tracked of nodes.values()) {
			if (tracked.kind === 'toast' && !tracked.leaving) {
				applyDepth(tracked.element, Number(tracked.element.dataset.depth ?? '0'));
			}
		}
	};

	const applyDrag = (element: HTMLElement, offset: number): void => {
		const depth = Number(element.dataset.depth ?? '0');
		const transform = stackTransform(depth);
		element.style.transform = `translateY(${transform.translateY + offset}px) scale(${transform.scale})`;
	};

	const finishLeave = (id: NoticeId): void => {
		const tracked = nodes.get(id);
		if (tracked === undefined) {
			return;
		}
		if (tracked.leaveTimeout !== null) {
			clearTimeout(tracked.leaveTimeout);
		}
		tracked.element.remove();
		nodes.delete(id);
	};

	const startLeave = (id: NoticeId): void => {
		const tracked = nodes.get(id);
		if (tracked === undefined || tracked.leaving) {
			return;
		}
		tracked.leaving = true;
		tracked.element.classList.add('notice-leaving');
		const onAnimationEnd = (event: AnimationEvent): void => {
			// The pop-in may still be running when a notice is dismissed; only its own exit
			// animation ending means the node can go (the timeout covers reduced motion).
			if (event.animationName === LEAVE_ANIMATION_NAME) {
				finishLeave(id);
			}
		};
		tracked.element.addEventListener('animationend', onAnimationEnd);
		tracked.leaveTimeout = setTimeout(() => finishLeave(id), LEAVE_FALLBACK_MS);
	};

	const ensureNode = (
		id: NoticeId,
		kind: Notice['kind'],
		create: () => HTMLElement
	): HTMLElement => {
		const existing = nodes.get(id);
		if (existing !== undefined && !existing.leaving) {
			return existing.element;
		}
		if (existing?.leaving) {
			finishLeave(id);
		}
		const element = create();
		nodes.set(id, { element, kind, leaving: false, leaveTimeout: null });
		return element;
	};

	/** Pointer-drag-to-dismiss, shared by toasts and the card. */
	const attachSwipe = (element: HTMLElement, id: NoticeId): void => {
		let dragging = false;
		let startY = 0;
		let startTime = 0;
		let lastDelta = 0;

		const onPointerDown = (event: PointerEvent): void => {
			dragging = true;
			startY = event.clientY;
			startTime = event.timeStamp;
			lastDelta = 0;
			element.setPointerCapture?.(event.pointerId);
			element.classList.add('notice-dragging');
			handlers.onHold();
		};

		const onPointerMove = (event: PointerEvent): void => {
			if (!dragging) {
				return;
			}
			lastDelta = Math.max(0, event.clientY - startY);
			applyDrag(element, lastDelta);
		};

		const endDrag = (event: PointerEvent): void => {
			if (!dragging) {
				return;
			}
			dragging = false;
			element.classList.remove('notice-dragging');
			const elapsed = Math.max(1, event.timeStamp - startTime);
			const velocity = lastDelta / elapsed;
			if (swipeOutcome(lastDelta, velocity) === 'dismiss') {
				handlers.onDismiss(id);
			} else {
				applyDrag(element, 0);
			}
			handlers.onRelease();
		};

		element.addEventListener('pointerdown', onPointerDown);
		element.addEventListener('pointermove', onPointerMove);
		element.addEventListener('pointerup', endDrag);
		element.addEventListener('pointercancel', endDrag);
	};

	const createToast = (toast: Toast): HTMLElement => {
		const element = document.createElement('div');
		element.className = `notice notice-toast notice-${toast.tone} notice-enter`;
		element.setAttribute('role', roleOf(toast.tone));
		element.setAttribute('aria-live', ariaLiveOf(toast.tone));
		element.setAttribute('aria-atomic', 'true');
		element.tabIndex = 0;

		const handle = document.createElement('span');
		handle.className = 'notice-handle';
		handle.setAttribute('aria-hidden', 'true');

		element.append(handle, iconElement(toast.tone), messageElement(toast.message));
		element.appendChild(dismissButton(() => handlers.onDismiss(toast.id)));

		attachSwipe(element, toast.id);

		element.addEventListener('click', (event) => {
			if (event.target instanceof HTMLButtonElement) {
				return;
			}
			const depth = Number(element.dataset.depth ?? '0');
			if (!expanded && depth > 0) {
				setExpanded(true);
				return;
			}
			handlers.onDismiss(toast.id);
		});

		element.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				handlers.onDismiss(toast.id);
			}
		});

		return element;
	};

	const createStatus = (status: Status): HTMLElement => {
		const element = document.createElement('div');
		element.className = `notice notice-status notice-${status.tone}`;
		element.setAttribute('role', 'status');
		element.setAttribute('aria-live', ariaLiveOf(status.tone));
		element.setAttribute('aria-atomic', 'true');
		element.append(dotElement(), messageElement(status.message));
		return element;
	};

	const createCard = (card: Card): HTMLElement => {
		const element = document.createElement('div');
		element.className = `notice notice-card notice-${card.tone} notice-enter`;
		element.setAttribute('role', 'status');
		element.setAttribute('aria-live', ariaLiveOf(card.tone));
		element.setAttribute('aria-atomic', 'true');
		element.tabIndex = 0;

		const body = document.createElement('div');
		body.className = 'notice-card-body';
		body.append(iconElement(card.tone), messageElement(card.message));
		element.appendChild(body);

		if (card.action !== null) {
			const action = document.createElement('button');
			action.type = 'button';
			action.className = 'notice-action';
			action.textContent = card.action.label;
			action.addEventListener('click', () => handlers.onSelect(card.id));
			element.appendChild(action);
		}
		element.appendChild(dismissButton(() => handlers.onDismiss(card.id)));

		attachSwipe(element, card.id);

		element.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				handlers.onDismiss(card.id);
			}
		});

		return element;
	};

	const upsertStatus = (status: Status): void => {
		const element = ensureNode(status.id, 'status', () => createStatus(status));
		statusRegion.appendChild(element);
	};

	const upsertToasts = (toasts: readonly Toast[]): void => {
		toasts.forEach((toast, depth) => {
			const element = ensureNode(toast.id, 'toast', () => createToast(toast));
			stack.appendChild(element);
			applyDepth(element, depth);
		});
	};

	const upsertCard = (card: Card): void => {
		const element = ensureNode(card.id, 'card', () => createCard(card));
		bottomRegion.appendChild(element);
	};

	const render = (state: NoticeState): void => {
		const visibleIds = new Set(visibleNotices(state).map((notice) => notice.id));

		for (const [id, tracked] of nodes) {
			if (!tracked.leaving && !visibleIds.has(id)) {
				startLeave(id);
			}
		}

		if (state.status !== null) {
			upsertStatus(state.status);
		}
		upsertToasts(state.toasts);
		if (state.card !== null) {
			upsertCard(state.card);
		}
	};

	stack.addEventListener('pointerenter', () => {
		handlers.onHold();
		setExpanded(true);
	});
	stack.addEventListener('pointerleave', () => {
		handlers.onRelease();
		setExpanded(false);
	});

	const onVisibilityChange = (): void => {
		if (document.hidden) {
			handlers.onHold();
		} else {
			handlers.onRelease();
		}
	};
	document.addEventListener('visibilitychange', onVisibilityChange);

	return {
		render,
		destroy: () => {
			document.removeEventListener('visibilitychange', onVisibilityChange);
			for (const tracked of nodes.values()) {
				if (tracked.leaveTimeout !== null) {
					clearTimeout(tracked.leaveTimeout);
				}
			}
			nodes.clear();
			container.remove();
		},
	};
};
