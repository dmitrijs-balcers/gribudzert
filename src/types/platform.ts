/**
 * Platform detection types
 */

/**
 * Platform discriminated union
 */
export type Platform =
  | { readonly type: "android" }
  | { readonly type: "ios" }
  | { readonly type: "desktop" };

/**
 * Detect current platform from user agent
 */
export const detectPlatform = (): Platform => {
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS =
    /iP(hone|od|ad)/i.test(ua) ||
    (navigator.platform && /iP(hone|od|ad)/.test(navigator.platform));

  if (isAndroid) {
    return { type: "android" };
  }

  if (isIOS) {
    return { type: "ios" };
  }

  return { type: "desktop" };
};
