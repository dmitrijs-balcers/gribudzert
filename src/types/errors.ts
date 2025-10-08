/**
 * Error types for the application
 * Using discriminated unions for type-safe error handling
 */

/**
 * Network and API fetch errors
 */
export type FetchError =
	| { readonly type: 'network'; readonly message: string }
	| { readonly type: 'parse'; readonly message: string }
	| { readonly type: 'timeout'; readonly message: string };

/**
 * Geolocation errors
 */
export type GeolocationError =
	| { readonly type: 'permission_denied'; readonly message: string }
	| { readonly type: 'unavailable'; readonly message: string }
	| { readonly type: 'timeout'; readonly message: string }
	| { readonly type: 'insecure_context'; readonly message: string };

/**
 * Map initialization errors
 */
export type MapError =
	| { readonly type: 'container_not_found'; readonly message: string }
	| { readonly type: 'initialization_failed'; readonly message: string };

/**
 * Data parsing errors
 */
export type ParseError =
	| { readonly type: 'invalid_format'; readonly message: string }
	| { readonly type: 'missing_required_field'; readonly field: string; readonly message: string }
	| { readonly type: 'invalid_coordinates'; readonly message: string };

/**
 * General application errors
 */
export type AppError = FetchError | GeolocationError | MapError | ParseError;
