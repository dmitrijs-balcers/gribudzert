export type FetchError =
	| { readonly type: 'network'; readonly message: string }
	| { readonly type: 'parse'; readonly message: string }
	| { readonly type: 'timeout'; readonly message: string }
	| { readonly type: 'aborted'; readonly message: string }
	| {
			readonly type: 'busy';
			readonly status: number;
			readonly retryAfterMs: number | null;
			readonly message: string;
	  };

export type LocationError =
	| { readonly type: 'permission-denied'; readonly message: string }
	| { readonly type: 'position-unavailable'; readonly message: string }
	| { readonly type: 'timeout'; readonly message: string }
	| { readonly type: 'not-supported'; readonly message: string };

export type LocationFailureCategory =
	| 'permission_denied'
	| 'position_unavailable'
	| 'timeout'
	| 'not_supported'
	| 'insecure_context';

export const toLocationFailureCategory = (error: LocationError): LocationFailureCategory => {
	const mapping: Record<LocationError['type'], LocationFailureCategory> = {
		'permission-denied': 'permission_denied',
		'position-unavailable': 'position_unavailable',
		timeout: 'timeout',
		'not-supported': 'not_supported',
	};
	return mapping[error.type];
};
