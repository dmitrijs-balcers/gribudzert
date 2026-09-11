import type { Facility, Located, UserPosition } from '../../domain';
import type { LayerKind } from '../layers';

export type GuidanceAppEvent =
	| { readonly kind: 'position-updated'; readonly position: UserPosition }
	| { readonly kind: 'nearest-water-changed'; readonly nearest: Located<Facility> | null }
	| { readonly kind: 'facility-selected'; readonly item: Located<Facility> }
	| { readonly kind: 'target-revealed' }
	| { readonly kind: 'sheet-closed' }
	| { readonly kind: 'guidance-dismissed' }
	| { readonly kind: 'layer-toggled'; readonly layer: LayerKind; readonly active: boolean };
