/**
 * Logging utility functions
 * Wraps console methods for consistent logging across the application
 */

/**
 * Log an informational message
 * @param message - The message to log
 * @param args - Additional arguments to log
 */
export function info(message: string, ...args: unknown[]): void {
  console.info(message, ...args);
}

/**
 * Log a warning message
 * @param message - The message to log
 * @param args - Additional arguments to log
 */
export function warn(message: string, ...args: unknown[]): void {
  console.warn(message, ...args);
}

/**
 * Log an error message
 * @param message - The message to log
 * @param args - Additional arguments to log
 */
export function error(message: string, ...args: unknown[]): void {
  console.error(message, ...args);
}

