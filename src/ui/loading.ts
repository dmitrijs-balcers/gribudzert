export const DEFAULT_LOADING_DELAY_MS = 200;

const HIDE_ANIMATION_MS = 300;

type LoadingOverlayState = {
	element: HTMLDivElement | null;
	showTimer: ReturnType<typeof setTimeout> | null;
	removeTimer: ReturnType<typeof setTimeout> | null;
	pendingOperations: number;
};

const createLoadingOverlayState = (): LoadingOverlayState => ({
	element: null,
	showTimer: null,
	removeTimer: null,
	pendingOperations: 0,
});

const overlay = createLoadingOverlayState();

const clearShowTimer = (): void => {
	if (overlay.showTimer !== null) {
		clearTimeout(overlay.showTimer);
		overlay.showTimer = null;
	}
};

const clearRemoveTimer = (): void => {
	if (overlay.removeTimer !== null) {
		clearTimeout(overlay.removeTimer);
		overlay.removeTimer = null;
	}
};

const createOverlayElement = (): HTMLDivElement => {
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
	overlay.showTimer = null;
	if (overlay.pendingOperations === 0) {
		return;
	}
	clearRemoveTimer();
	overlay.element ??= createOverlayElement();
	overlay.element.classList.add('loading-visible');
};

export function showLoading(delay: number = DEFAULT_LOADING_DELAY_MS): void {
	overlay.pendingOperations += 1;
	if (overlay.pendingOperations > 1) {
		return;
	}
	clearShowTimer();
	overlay.showTimer = setTimeout(revealOverlay, delay);
}

export function hideLoading(): void {
	if (overlay.pendingOperations === 0) {
		return;
	}
	overlay.pendingOperations -= 1;
	if (overlay.pendingOperations > 0) {
		return;
	}

	clearShowTimer();
	if (overlay.element === null) {
		return;
	}

	overlay.element.classList.remove('loading-visible');
	clearRemoveTimer();
	overlay.removeTimer = setTimeout(() => {
		overlay.removeTimer = null;
		if (overlay.element !== null && overlay.pendingOperations === 0) {
			overlay.element.remove();
			overlay.element = null;
		}
	}, HIDE_ANIMATION_MS);
}

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

export function pendingLoadingCount(): number {
	return overlay.pendingOperations;
}

export function isLoadingVisible(): boolean {
	return overlay.pendingOperations > 0;
}

export function resetLoading(): void {
	overlay.pendingOperations = 0;
	clearShowTimer();
	clearRemoveTimer();
	if (overlay.element !== null) {
		overlay.element.remove();
		overlay.element = null;
	}
}
