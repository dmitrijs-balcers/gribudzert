/**
 * DOM utility functions and type guards
 */

/**
 * Type guard to check if an element is an HTMLElement
 * @param el - The element to check
 * @returns true if the element is an HTMLElement
 */
export function isHTMLElement(el: Element | null): el is HTMLElement {
  return el !== null && el instanceof HTMLElement;
}

/**
 * Safely get an attribute from an element
 * @param el - The element to get the attribute from
 * @param name - The attribute name
 * @returns The attribute value or null if not found
 */
export function getAttribute(el: Element, name: string): string | null {
  return el.getAttribute(name);
}

/**
 * Safely query selector and check if result is HTMLElement
 * @param parent - The parent element to query from
 * @param selector - The CSS selector
 * @returns The HTMLElement or null if not found
 */
export function queryHTMLElement(
  parent: Element | Document,
  selector: string,
): HTMLElement | null {
  const el = parent.querySelector(selector);
  return isHTMLElement(el) ? el : null;
}

/**
 * Check if a keyboard event is an activation key (Enter or Space)
 * @param event - The keyboard event
 * @returns true if the key is Enter or Space
 */
export function isActivationKey(event: KeyboardEvent): boolean {
  return event.key === "Enter" || event.key === " ";
}
