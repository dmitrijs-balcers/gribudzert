/**
 * Loading overlay with accessibility support
 *
 * The overlay is reference counted: every `showLoading` must be balanced by a `hideLoading`,
 * and the overlay stays visible while at least one caller is still loading. Concurrent
 * operations (e.g. two layers refreshing at once) therefore share a single overlay that
 * disappears only when the last one finishes. Prefer `withLoading` over manual pairing so a
 * thrown error can never leave the overlay stuck.
 */

/**
 * Delay before the overlay becomes visible, so quick operations never flash it
 */
export const DEFAULT_LOADING_DELAY_MS = 200;

/**
 * Duration of the fade-out transition before the overlay is removed from the DOM
 */
const HIDE_ANIMATION_MS = 300;

let loadingElement: HTMLDivElement | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null;
let removeTimer: ReturnType<typeof setTimeout> | null = null;
let pending = 0;

const clearShowTimer = (): void => {
	if (showTimer !== null) {
		clearTimeout(showTimer);
		showTimer = null;
	}
};

const clearRemoveTimer = (): void => {
	if (removeTimer !== null) {
		clearTimeout(removeTimer);
		removeTimer = null;
	}
};

const createOverlay = (): HTMLDivElement => {
	const element = document.createElement('div');
	element.className = 'loading-overlay';
	element.setAttribute('role', 'status');
	element.setAttribute('aria-live', 'polite');
	element.setAttribute('aria-label', 'Loading');
	element.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
          <span class="loading-text">Loading...</span>
        </div>
      `;
	document.body.appendChild(element);
	return element;
};

const revealOverlay = (): void => {
	showTimer = null;
	if (pending === 0) {
		return;
	}
	clearRemoveTimer();
	loadingElement ??= createOverlay();
	loadingElement.classList.add('loading-visible');
};

/**
 * Register one loading operation. The overlay appears after `delay` ms unless every
 * registered operation has finished by then.
 * @param delay - Delay in ms before showing the overlay (default: 200ms)
 */
export function showLoading(delay: number = DEFAULT_LOADING_DELAY_MS): void {
	pending += 1;
	if (pending > 1) {
		return;
	}
	clearShowTimer();
	showTimer = setTimeout(revealOverlay, delay);
}

/**
 * Finish one loading operation. The overlay hides once no operation is pending.
 * Extra calls (without a matching `showLoading`) are ignored.
 */
export function hideLoading(): void {
	if (pending === 0) {
		return;
	}
	pending -= 1;
	if (pending > 0) {
		return;
	}

	clearShowTimer();
	if (loadingElement === null) {
		return;
	}

	loadingElement.classList.remove('loading-visible');
	clearRemoveTimer();
	removeTimer = setTimeout(() => {
		removeTimer = null;
		if (loadingElement !== null && pending === 0) {
			loadingElement.remove();
			loadingElement = null;
		}
	}, HIDE_ANIMATION_MS);
}

/**
 * Run an async operation while the overlay is shown; the overlay is always released,
 * whether the operation resolves or rejects.
 * @param fn - Operation to run
 * @param delay - Delay in ms before showing the overlay (default: 200ms)
 */
export async function withLoading<T>(
	fn: () => Promise<T>,
	delay: number = DEFAULT_LOADING_DELAY_MS
): Promise<T> {
	showLoading(delay);
	try {
		return await fn();
	} finally {
		hideLoading();
	}
}

/**
 * Number of loading operations currently registered
 */
export function pendingLoadingCount(): number {
	return pending;
}

/**
 * Whether at least one loading operation is registered (the overlay is shown or about to be)
 */
export function isLoadingVisible(): boolean {
	return pending > 0;
}

/**
 * Drop every registered loading operation and remove the overlay immediately.
 * Intended for teardown (e.g. between tests); production code should balance
 * `showLoading`/`hideLoading` or use `withLoading` instead.
 */
export function resetLoading(): void {
	pending = 0;
	clearShowTimer();
	clearRemoveTimer();
	if (loadingElement !== null) {
		loadingElement.remove();
		loadingElement = null;
	}
}
