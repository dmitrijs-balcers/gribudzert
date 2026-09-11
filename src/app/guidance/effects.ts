import type { Coordinates, FacilityKind, LatLon } from '../../domain';

export type GuidanceAppEffect =
	| { readonly kind: 'guidance-started'; readonly facilityKind: FacilityKind }
	| { readonly kind: 'origin-moved'; readonly position: LatLon }
	| { readonly kind: 'fly-to'; readonly coordinates: Coordinates };
