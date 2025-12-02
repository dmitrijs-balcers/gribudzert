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
 * Location detection errors for initial location detection
 * Uses discriminated union for exhaustive type checking
 */
export type LocationError =
	| { readonly type: 'permission-denied'; readonly message: string }
	| { readonly type: 'position-unavailable'; readonly message: string }
	| { readonly type: 'timeout'; readonly message: string }
	| { readonly type: 'not-supported'; readonly message: string };

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
export type AppError = FetchError | GeolocationError | MapError | ParseError | LocationError;

/**
 * Location failure categories for analytics
 * Uses snake_case per Umami event naming convention
 * Single source of truth for analytics location failure tracking
 */
export type LocationFailureCategory =
	| 'permission_denied'
	| 'position_unavailable'
	| 'timeout'
	| 'not_supported'
	| 'insecure_context';

/**
 * Map LocationError to LocationFailureCategory for analytics
 * Pure function with exhaustive type checking
 * @param error - LocationError from geolocation operations
 * @returns LocationFailureCategory for analytics tracking
 */
export const toLocationFailureCategory = (error: LocationError): LocationFailureCategory => {
	const mapping: Record<LocationError['type'], LocationFailureCategory> = {
		'permission-denied': 'permission_denied',
		'position-unavailable': 'position_unavailable',
		'timeout': 'timeout',
		'not-supported': 'not_supported',
	};
	return mapping[error.type];
};

/**
 * Map GeolocationError to LocationFailureCategory for analytics
 * Handles additional 'insecure_context' case from GeolocationError
 * @param error - GeolocationError from browser geolocation API
 * @returns LocationFailureCategory for analytics tracking
 */
export const geolocationToFailureCategory = (
	error: GeolocationError
): LocationFailureCategory => {
	const mapping: Record<GeolocationError['type'], LocationFailureCategory> = {
		'permission_denied': 'permission_denied',
		'unavailable': 'position_unavailable',
		'timeout': 'timeout',
		'insecure_context': 'insecure_context',
	};
	return mapping[error.type];
};
