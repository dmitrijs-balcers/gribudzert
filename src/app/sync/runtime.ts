import type * as L from 'leaflet';
import type { Facility, Located, RequestId, Timestamp } from '../../domain';
import type { Snapshot } from '../../features/cache/snapshot';
import type { OverpassQuery } from '../../features/data';
import { toLatLngBounds } from '../../features/navigation/bounds';
import type { FetchError } from '../../types/errors';
import type { Result } from '../../types/result';
import { isErr } from '../../types/result';
import type { NotificationType } from '../../ui/notifications';
import type { LayerKind } from '../layers';
import type { LayerRender, SyncEffect } from './effects';
import type { SyncEvent } from './events';
import type { DataProvenance } from './provenance';
import { apply } from './reducer';
import type { SyncState } from './state';

export type SyncPorts = {
	readonly now: () => Timestamp;
	readonly queryFor: (kinds: readonly LayerKind[]) => OverpassQuery;
	readonly fetchFacilities: (
		query: OverpassQuery,
		bounds: L.LatLngBounds,
		signal: AbortSignal
	) => Promise<Result<readonly Facility[], FetchError>>;
	readonly render: (layers: readonly LayerRender[]) => void;
	readonly clearRender: () => void;
	readonly notify: (message: string, type: NotificationType, duration: number) => void;
	readonly showLoading: () => void;
	readonly hideLoading: () => void;
	readonly persist: (snapshot: Snapshot) => void;
	readonly reportNearest: (kind: LayerKind, nearest: Located<Facility> | null) => void;
	readonly trackAreaExplored: () => void;
	readonly trackEmptyArea: (kind: LayerKind) => void;
	readonly reportProvenance: (provenance: DataProvenance | null) => void;
};

export type SyncRuntime = {
	readonly dispatch: (event: SyncEvent) => void;
};

export const createSyncRuntime = (ports: SyncPorts, initial: SyncState): SyncRuntime => {
	let state = initial;
	const controllers = new Map<RequestId, AbortController>();

	const dispatch = (event: SyncEvent): void => {
		const [nextState, effects] = apply(state, event, ports.now());
		state = nextState;
		for (const effect of effects) {
			runEffect(effect);
		}
	};

	const startFetch = (effect: Extract<SyncEffect, { readonly kind: 'start-fetch' }>): void => {
		const controller = new AbortController();
		controllers.set(effect.request, controller);
		const query = ports.queryFor(effect.kinds);
		const bounds = toLatLngBounds(effect.bounds);
		ports.fetchFacilities(query, bounds, controller.signal).then((result) => {
			controllers.delete(effect.request);
			if (isErr(result)) {
				if (result.error.type === 'aborted') {
					return;
				}
				dispatch({ kind: 'fetch-failed', request: effect.request, error: result.error });
				return;
			}
			dispatch({
				kind: 'fetch-succeeded',
				request: effect.request,
				tiles: effect.tiles,
				kinds: effect.kinds,
				facilities: result.value,
			});
		});
	};

	const runEffect = (effect: SyncEffect): void => {
		switch (effect.kind) {
			case 'start-fetch':
				startFetch(effect);
				return;
			case 'abort-fetch': {
				const controller = controllers.get(effect.request);
				controller?.abort();
				controllers.delete(effect.request);
				return;
			}
			case 'render':
				ports.render(effect.layers);
				return;
			case 'clear-render':
				ports.clearRender();
				return;
			case 'notify':
				ports.notify(effect.message, effect.notificationType, effect.duration);
				return;
			case 'show-loading':
				ports.showLoading();
				return;
			case 'hide-loading':
				ports.hideLoading();
				return;
			case 'persist':
				ports.persist(effect.snapshot);
				return;
			case 'report-nearest':
				ports.reportNearest(effect.layer, effect.nearest);
				return;
			case 'track-area-explored':
				ports.trackAreaExplored();
				return;
			case 'track-empty-area':
				ports.trackEmptyArea(effect.layer);
				return;
			case 'report-provenance':
				ports.reportProvenance(effect.provenance);
				return;
			default: {
				const exhaustive: never = effect;
				throw new Error(`Unhandled sync effect: ${JSON.stringify(exhaustive)}`);
			}
		}
	};

	return { dispatch };
};
