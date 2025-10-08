/**
 * Loading spinner with accessibility support
 */

let loadingElement: HTMLDivElement | null = null;
let loadingTimeout: number | null = null;
let isLoading = false;

/**
 * Show loading spinner with optional delay to prevent flashing
 * @param delay - Delay in ms before showing spinner (default: 200ms)
 */
export function showLoading(delay: number = 200): void {
  if (isLoading) return;
  isLoading = true;

  // Clear any existing timeout
  if (loadingTimeout !== null) {
    clearTimeout(loadingTimeout);
  }

  // Delay showing to prevent flashing for quick operations
  loadingTimeout = window.setTimeout(() => {
    if (!isLoading) return; // Check if hideLoading was called during delay

    if (!loadingElement) {
      loadingElement = document.createElement('div');
      loadingElement.className = 'loading-overlay';
      loadingElement.setAttribute('role', 'status');
      loadingElement.setAttribute('aria-live', 'polite');
      loadingElement.setAttribute('aria-label', 'Loading');

      loadingElement.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
          <span class="loading-text">Loading...</span>
        </div>
      `;

      document.body.appendChild(loadingElement);
    }

    loadingElement.classList.add('loading-visible');
  }, delay);
}

/**
 * Hide loading spinner
 */
export function hideLoading(): void {
  isLoading = false;

  // Clear timeout if spinner hasn't appeared yet
  if (loadingTimeout !== null) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }

  if (!loadingElement) return;

  loadingElement.classList.remove('loading-visible');

  // Remove from DOM after animation
  setTimeout(() => {
    if (loadingElement && !isLoading) {
      loadingElement.remove();
      loadingElement = null;
    }
  }, 300);
}

/**
 * Check if loading is currently visible
 */
export function isLoadingVisible(): boolean {
  return isLoading;
}

