/**
 * The DOM layer of the notice centre (`createNoticeView`): keyed reconciliation, ARIA,
 * dismiss/select wiring, hold/release signalling, and the pure swipe/stack helpers.
 *
 * The reducer's own rules are covered in notice.test.ts; the runtime that wires ports is
 * covered in notice-center.test.ts. Here we only check what the DOM renders and reports.
 */
import { describe, expect, it, vi } from 'vitest';
import type {
	Card,
	NoticeAction,
	NoticeState,
	NoticeTone,
	Status,
	Timestamp,
	Toast,
} from '../../src/domain';
import { noticeId, timestamp } from '../../src/domain';
import type { NoticeViewHandlers } from '../../src/ui/notices';
import { createNoticeView, stackTransform, swipeOutcome } from '../../src/ui/notices';

const at = (n: number): Timestamp => {
	const t = timestamp(n);
	if (t === null) {
		throw new Error(`Invalid timestamp for a test fixture: ${n}`);
	}
	return t;
};

const emptyState: NoticeState = { toasts: [], status: null, card: null, heldSince: null };

const toast = (id: string, message: string, tone: NoticeTone = 'neutral'): Toast => ({
	kind: 'toast',
	message,
	tone,
	id: noticeId(id),
	expiresAt: at(10_000),
});

const status = (id: string, message: string, tone: NoticeTone = 'neutral'): Status => ({
	kind: 'status',
	message,
	tone,
	id: noticeId(id),
});

const card = (
	id: string,
	message: string,
	action: NoticeAction | null,
	tone: NoticeTone = 'neutral'
): Card => ({
	kind: 'card',
	message,
	tone,
	id: noticeId(id),
	action,
});

const createHandlers = (): NoticeViewHandlers => ({
	onDismiss: vi.fn(),
	onSelect: vi.fn(),
	onHold: vi.fn(),
	onRelease: vi.fn(),
});

const mount = () => {
	const host = document.createElement('div');
	document.body.appendChild(host);
	return host;
};

const click = (element: Element): void => {
	element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};

const keydown = (element: Element, key: string): void => {
	element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
};

describe('createNoticeView: rendering', () => {
	it('renders a toast, a status, and a card with the right classes and ARIA', () => {
		const host = mount();
		const handlers = createHandlers();
		const view = createNoticeView(host, handlers);

		const state: NoticeState = {
			toasts: [toast('t1', 'Back online.', 'success')],
			status: status('s1', 'Offline', 'warning'),
			card: card('c1', 'A new version is ready.', { label: 'Reload' }, 'neutral'),
			heldSince: null,
		};
		view.render(state);

		const toastEl = host.querySelector('.notice-toast');
		expect(toastEl).not.toBeNull();
		expect(toastEl?.classList.contains('notice')).toBe(true);
		expect(toastEl?.classList.contains('notice-success')).toBe(true);
		expect(toastEl?.getAttribute('role')).toBe('status');
		expect(toastEl?.getAttribute('aria-live')).toBe('polite');
		expect(toastEl?.getAttribute('aria-atomic')).toBe('true');
		expect(toastEl?.querySelector('.notice-message')?.textContent).toBe('Back online.');
		expect(toastEl?.querySelector('.notice-icon')).not.toBeNull();
		expect(toastEl?.querySelector('.notice-handle')).not.toBeNull();
		expect(toastEl?.querySelector('.notice-dismiss.visually-hidden')).not.toBeNull();

		const statusEl = host.querySelector('.notice-status');
		expect(statusEl).not.toBeNull();
		expect(statusEl?.classList.contains('notice-warning')).toBe(true);
		expect(statusEl?.querySelector('.notice-dot')).not.toBeNull();

		const cardEl = host.querySelector('.notice-card');
		expect(cardEl).not.toBeNull();
		expect(cardEl?.getAttribute('role')).toBe('status');
		expect(cardEl?.querySelector('.notice-action')?.textContent).toBe('Reload');

		view.destroy();
	});

	it('gives an error-toned notice role=alert and aria-live=assertive', () => {
		const host = mount();
		const view = createNoticeView(host, createHandlers());

		view.render({ ...emptyState, toasts: [toast('t1', 'Something failed.', 'error')] });

		const toastEl = host.querySelector('.notice-toast');
		expect(toastEl?.getAttribute('role')).toBe('alert');
		expect(toastEl?.getAttribute('aria-live')).toBe('assertive');

		view.destroy();
	});

	it('sets a data-depth on each toast in the stack', () => {
		const host = mount();
		const view = createNoticeView(host, createHandlers());

		view.render({
			...emptyState,
			toasts: [toast('t1', 'Newest'), toast('t2', 'Middle'), toast('t3', 'Oldest')],
		});

		expect(
			host.querySelector('[data-depth="0"]')?.querySelector('.notice-message')?.textContent
		).toBe('Newest');
		expect(
			host.querySelector('[data-depth="2"]')?.querySelector('.notice-message')?.textContent
		).toBe('Oldest');

		view.destroy();
	});

	it('keeps the same DOM node for an unchanged notice across renders', () => {
		const host = mount();
		const view = createNoticeView(host, createHandlers());

		view.render({ ...emptyState, toasts: [toast('t1', 'Stable')] });
		const first = host.querySelector('.notice-toast');

		view.render({ ...emptyState, toasts: [toast('t1', 'Stable')] });
		const second = host.querySelector('.notice-toast');

		expect(first).not.toBeNull();
		expect(second).toBe(first);

		view.destroy();
	});
});

describe('createNoticeView: leaving', () => {
	it('adds notice-leaving then removes the node after the fallback timeout', () => {
		vi.useFakeTimers();
		const host = mount();
		const view = createNoticeView(host, createHandlers());

		view.render({ ...emptyState, toasts: [toast('t1', 'Bye')] });
		expect(host.querySelector('.notice-toast')).not.toBeNull();

		view.render(emptyState);
		const leaving = host.querySelector('.notice-toast');
		expect(leaving).not.toBeNull();
		expect(leaving?.classList.contains('notice-leaving')).toBe(true);

		vi.advanceTimersByTime(300);
		expect(host.querySelector('.notice-toast')).toBeNull();

		view.destroy();
	});
});

describe('createNoticeView: dismiss and select', () => {
	it('tapping a toast calls onDismiss with its id', () => {
		const host = mount();
		const handlers = createHandlers();
		const view = createNoticeView(host, handlers);

		view.render({ ...emptyState, toasts: [toast('t1', 'Tap me')] });
		const toastEl = host.querySelector('.notice-toast');
		if (toastEl === null) {
			throw new Error('Expected a toast element');
		}
		click(toastEl);

		expect(handlers.onDismiss).toHaveBeenCalledWith(noticeId('t1'));

		view.destroy();
	});

	it('clicking the card action calls onSelect with the card id, not onDismiss', () => {
		const host = mount();
		const handlers = createHandlers();
		const view = createNoticeView(host, handlers);

		view.render({ ...emptyState, card: card('c1', 'Update ready', { label: 'Reload' }) });
		const action = host.querySelector('.notice-action');
		if (action === null) {
			throw new Error('Expected an action button');
		}
		click(action);

		expect(handlers.onSelect).toHaveBeenCalledWith(noticeId('c1'));
		expect(handlers.onDismiss).not.toHaveBeenCalled();

		view.destroy();
	});

	it('Escape on a focused toast calls onDismiss', () => {
		const host = mount();
		const handlers = createHandlers();
		const view = createNoticeView(host, handlers);

		view.render({ ...emptyState, toasts: [toast('t1', 'Focus me')] });
		const toastEl = host.querySelector('.notice-toast');
		if (toastEl === null) {
			throw new Error('Expected a toast element');
		}
		keydown(toastEl, 'Escape');

		expect(handlers.onDismiss).toHaveBeenCalledWith(noticeId('t1'));

		view.destroy();
	});

	it('the hidden dismiss button also calls onDismiss, for assistive tech', () => {
		const host = mount();
		const handlers = createHandlers();
		const view = createNoticeView(host, handlers);

		view.render({ ...emptyState, toasts: [toast('t1', 'AT dismiss')] });
		const button = host.querySelector('.notice-dismiss');
		if (button === null) {
			throw new Error('Expected a hidden dismiss button');
		}
		click(button);

		expect(handlers.onDismiss).toHaveBeenCalledWith(noticeId('t1'));

		view.destroy();
	});
});

describe('createNoticeView: hold / release', () => {
	it('pointerenter on the stack calls onHold; pointerleave calls onRelease', () => {
		const host = mount();
		const handlers = createHandlers();
		const view = createNoticeView(host, handlers);

		view.render({ ...emptyState, toasts: [toast('t1', 'Hover')] });
		const stack = host.querySelector('.notice-stack');
		if (stack === null) {
			throw new Error('Expected the stack container');
		}

		stack.dispatchEvent(new PointerEvent('pointerenter'));
		expect(handlers.onHold).toHaveBeenCalledTimes(1);

		stack.dispatchEvent(new PointerEvent('pointerleave'));
		expect(handlers.onRelease).toHaveBeenCalledTimes(1);

		view.destroy();
	});

	it('document visibilitychange calls onHold when hidden, onRelease when visible', () => {
		const host = mount();
		const handlers = createHandlers();
		const view = createNoticeView(host, handlers);

		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
		expect(handlers.onHold).toHaveBeenCalledTimes(1);

		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
		expect(handlers.onRelease).toHaveBeenCalledTimes(1);

		view.destroy();
	});
});

describe('createNoticeView: destroy', () => {
	it('removes the container and stops listening for visibilitychange', () => {
		const host = mount();
		const handlers = createHandlers();
		const view = createNoticeView(host, handlers);

		view.render({ ...emptyState, toasts: [toast('t1', 'Gone soon')] });
		expect(host.querySelector('.notice-center')).not.toBeNull();

		view.destroy();
		expect(host.querySelector('.notice-center')).toBeNull();

		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
		expect(handlers.onHold).not.toHaveBeenCalled();
	});
});

describe('swipeOutcome', () => {
	it('dismisses a 50px downward swipe', () => {
		expect(swipeOutcome(50, 0)).toBe('dismiss');
	});

	it('keeps a small, slow downward drag', () => {
		expect(swipeOutcome(10, 0.05)).toBe('keep');
	});

	it('dismisses a fast flick even when the distance is short', () => {
		expect(swipeOutcome(12, 0.8)).toBe('dismiss');
	});

	it('keeps an upward drag regardless of speed', () => {
		expect(swipeOutcome(-60, 2)).toBe('keep');
	});
});

describe('stackTransform', () => {
	it('is identity at depth 0', () => {
		const transform = stackTransform(0);
		expect(transform.translateY === 0).toBe(true);
		expect(transform.scale).toBe(1);
		expect(transform.opacity).toBe(1);
		expect(transform.zIndex).toBe(100);
	});

	it('peeks back, shrinks, and fades with increasing depth', () => {
		const depth1 = stackTransform(1);
		const depth2 = stackTransform(2);

		expect(depth1.translateY).toBeLessThan(0);
		expect(depth1.scale).toBeLessThan(1);
		expect(depth1.opacity).toBeLessThan(1);
		expect(depth2.translateY).toBeLessThan(depth1.translateY);
		expect(depth2.zIndex).toBeLessThan(depth1.zIndex);
	});
});
