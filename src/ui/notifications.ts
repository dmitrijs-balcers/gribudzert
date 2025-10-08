/**
 * Toast notification system with accessibility support
 */

export type NotificationType = 'info' | 'success' | 'error' | 'warning';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  element: HTMLDivElement;
}

const notifications: Map<string, Notification> = new Map();
let container: HTMLDivElement | null = null;

/**
 * Initialize notification container
 */
function initContainer(): HTMLDivElement {
  if (container) return container;

  container = document.createElement('div');
  container.className = 'notification-container';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'false');
  document.body.appendChild(container);

  return container;
}

/**
 * Show a notification toast
 * @param message - Message to display
 * @param type - Notification type (info, success, error, warning)
 * @param duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
 * @returns Notification ID for manual dismissal
 */
export function showNotification(
  message: string,
  type: NotificationType = 'info',
  duration: number = 3000
): string {
  const container = initContainer();
  const id = `notification-${Date.now()}-${Math.random()}`;

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.setAttribute('role', 'status');
  notification.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  notification.setAttribute('tabindex', '0');

  // Icon based on type
  const icons: Record<NotificationType, string> = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  };

  notification.innerHTML = `
    <span class="notification-icon" aria-hidden="true">${icons[type]}</span>
    <span class="notification-message">${escapeHtml(message)}</span>
    <button class="notification-close" aria-label="Dismiss notification" tabindex="0">×</button>
  `;

  // Close button handler
  const closeBtn = notification.querySelector('.notification-close') as HTMLButtonElement;
  closeBtn.addEventListener('click', () => dismissNotification(id));
  closeBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dismissNotification(id);
    }
  });

  // Keyboard dismiss on Escape
  notification.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dismissNotification(id);
    }
  });

  // Add to container with animation
  container.appendChild(notification);
  notifications.set(id, { id, message, type, element: notification });

  // Focus on notification for accessibility
  setTimeout(() => {
    notification.focus();
  }, 100);

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => {
      dismissNotification(id);
    }, duration);
  }

  return id;
}

/**
 * Dismiss a notification by ID
 */
export function dismissNotification(id: string): void {
  const notification = notifications.get(id);
  if (!notification) return;

  // Fade out animation
  notification.element.classList.add('notification-exit');

  setTimeout(() => {
    notification.element.remove();
    notifications.delete(id);
  }, 300);
}

/**
 * Clear all notifications
 */
export function clearAllNotifications(): void {
  notifications.forEach((_, id) => dismissNotification(id));
}

/**
 * Simple HTML escape to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

