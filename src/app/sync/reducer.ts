import {
	CACHE_TILE_ZOOM,
	EMPTY_AREA_NOTIFICATION_COOLDOWN_MS,
	FACILITY_CACHE_MAX_TILES,
	FACILITY_CACHE_TTL_MS,
	FETCH_PADDING_FACTOR,
	FETCH_RETRY_BACKOFF_MS,
	MIN_FETCH_ZOOM,
} from '../../core/config';
import {
	boundsOfTiles,
	type Connectivity,
	type Coverage,
	classify,
	clearMany,
	issueRequestId,
	type LatLon,
	markFailed,
	markLoading,
	nearestOf,
	padTileBounds,
	statusOf,
	type TileId,
	type TileStatus,
	type Timestamp,
	tilesCovering,
	tilesThatMustBeLoaded,
	type Viewport,
	wantsFetch,
} from '../../domain';
import { evict, mergeSnapshots, reconcile, type Snapshot } from '../../features/cache/snapshot';
import { LAYER_KINDS, type LayerKind, locateFacilities } from '../layers';
import {
	BACK_ONLINE_MESSAGE,
	emptyAreaMessage,
	fetchErrorMessage,
	OFFLINE_SHOWING_SAVED_MESSAGE,
	OFFLINE_STATUS_MESSAGE,
	ZOOMED_OUT_MESSAGE,
} from '../messages';
import type { LayerRender, SyncEffect } from './effects';
import type { SyncEvent } from './events';
import { provenanceOf } from './provenance';
import type { PendingFetch, SyncState } from './state';

const neededTilesOf = (viewport: Viewport): readonly TileId[] =>
	tilesCovering(padTileBounds(viewport.bounds, FETCH_PADDING_FACTOR), CACHE_TILE_ZOOM);

const facilitiesFor = (snapshot: Snapshot, tileSet: ReadonlySet<TileId>, kind: LayerKind) =>
	Object.values(snapshot.facilities)
		.filter((cached) => tileSet.has(cached.tile) && cached.facility.kind === kind)
		.map((cached) => cached.facility);

const isKnown = (snapshot: Snapshot, tiles: readonly TileId[], kind: LayerKind): boolean =>
	tiles.some((tile) => snapshot.tiles[tile]?.[kind] !== undefined);

const canNotifyEmptyArea = (
	emptyAreaNotifiedAt: Readonly<Record<LayerKind, Timestamp | null>>,
	kind: LayerKind,
	now: Timestamp
): boolean => {
	const last = emptyAreaNotifiedAt[kind];
	return last === null || now - last >= EMPTY_AREA_NOTIFICATION_COOLDOWN_MS;
};

const releasePending = (
	fetch: PendingFetch | null,
	coverage: Coverage
): { readonly coverage: Coverage; readonly effects: readonly SyncEffect[] } => {
	if (fetch === null) {
		return { coverage, effects: [] };
	}
	const effects: SyncEffect[] = [{ kind: 'abort-fetch', request: fetch.id }];
	if (fetch.loadingShown) {
		effects.push({ kind: 'hide-loading' });
	}
	return { coverage: clearMany(coverage, fetch.tiles, fetch.kinds), effects };
};

const settleZoomedOut = (
	state: SyncState,
	viewport: Viewport
): readonly [SyncState, readonly SyncEffect[]] => {
	const released = releasePending(state.pending, state.coverage);
	const effects: SyncEffect[] = [
		...released.effects,
		{ kind: 'clear-render' },
		{ kind: 'report-provenance', provenance: null },
	];
	if (!state.zoomedOutNoticeShown) {
		effects.push({
			kind: 'notify',
			request: { kind: 'toast', message: ZOOMED_OUT_MESSAGE, tone: 'neutral' },
		});
	}
	const nextState: SyncState = {
		...state,
		viewport,
		coverage: released.coverage,
		pending: null,
		zoomedOutNoticeShown: true,
	};
	return [nextState, effects];
};

type FetchableProjection = {
	readonly renders: readonly LayerRender[];
	readonly missingTiles: ReadonlySet<TileId>;
	readonly missingKinds: ReadonlySet<LayerKind>;
	readonly reportableKinds: ReadonlySet<LayerKind>;
};

type TileKindStatus = {
	readonly tile: TileId;
	readonly needsFetch: boolean;
	readonly isFresh: boolean;
	readonly triggersFetch: boolean;
};

const statusesOf = (
	snapshot: Snapshot,
	coverage: Coverage,
	neededTiles: readonly TileId[],
	triggerTileSet: ReadonlySet<TileId>,
	kind: LayerKind,
	now: Timestamp
): readonly TileKindStatus[] =>
	neededTiles.map((tile) => {
		const fetchedAt = snapshot.tiles[tile]?.[kind];
		const status = statusOf(coverage, fetchedAt, tile, kind, now, FACILITY_CACHE_TTL_MS);
		const needsFetch = wantsFetch(status, now);
		return {
			tile,
			needsFetch,
			isFresh: status.kind === 'fresh',
			triggersFetch: needsFetch && triggerTileSet.has(tile),
		};
	});

const projectFetchable = (
	snapshot: Snapshot,
	coverage: Coverage,
	neededTiles: readonly TileId[],
	triggerTiles: readonly TileId[],
	activeKinds: readonly LayerKind[],
	origin: LatLon,
	now: Timestamp
): FetchableProjection => {
	const neededTileSet = new Set(neededTiles);
	const triggerTileSet = new Set(triggerTiles);
	const renders: LayerRender[] = [];
	const missingTiles = new Set<TileId>();
	const missingKinds = new Set<LayerKind>();
	const reportableKinds = new Set<LayerKind>();

	for (const kind of activeKinds) {
		const statuses = statusesOf(snapshot, coverage, neededTiles, triggerTileSet, kind, now);

		if (statuses.every((entry) => entry.isFresh)) {
			reportableKinds.add(kind);
		}
		if (statuses.some((entry) => entry.triggersFetch)) {
			for (const entry of statuses) {
				if (entry.needsFetch) {
					missingTiles.add(entry.tile);
					missingKinds.add(kind);
				}
			}
		}

		const facilities = facilitiesFor(snapshot, neededTileSet, kind);
		renders.push({ kind, items: locateFacilities(kind, facilities, origin) });
	}

	return { renders, missingTiles, missingKinds, reportableKinds };
};

const overlapsNeeded = (fetch: PendingFetch, neededTileSet: ReadonlySet<TileId>): boolean =>
	fetch.tiles.some((tile) => neededTileSet.has(tile));

const provenanceEffectOf = (
	snapshot: Snapshot,
	coverage: Coverage,
	neededTiles: readonly TileId[],
	activeKinds: readonly LayerKind[],
	sessionStartedAt: Timestamp,
	connectivity: Connectivity,
	now: Timestamp
): SyncEffect => {
	if (activeKinds.length === 0) {
		return { kind: 'report-provenance', provenance: null };
	}
	if (connectivity === 'offline') {
		return { kind: 'report-provenance', provenance: 'offline' };
	}
	const statuses: TileStatus[] = [];
	for (const tile of neededTiles) {
		for (const kind of activeKinds) {
			const fetchedAt = snapshot.tiles[tile]?.[kind];
			statuses.push(statusOf(coverage, fetchedAt, tile, kind, now, FACILITY_CACHE_TTL_MS));
		}
	}
	return { kind: 'report-provenance', provenance: provenanceOf(statuses, sessionStartedAt) };
};

const settleFetchable = (
	state: SyncState,
	viewport: Viewport,
	now: Timestamp
): readonly [SyncState, readonly SyncEffect[]] => {
	const neededTiles = neededTilesOf(viewport);
	const neededTileSet = new Set(neededTiles);
	const triggerTiles = tilesThatMustBeLoaded(viewport, state.viewport, neededTiles);
	const activeKinds = LAYER_KINDS.filter((kind) => state.layers[kind]);

	const overlapping =
		state.pending !== null && overlapsNeeded(state.pending, neededTileSet) ? state.pending : null;
	const disjoint = state.pending !== null && overlapping === null ? state.pending : null;

	const releasedDisjoint = releasePending(disjoint, state.coverage);
	let coverage = releasedDisjoint.coverage;
	const effects: SyncEffect[] = [...releasedDisjoint.effects];

	const origin: LatLon = state.userOrigin === null ? viewport.center : state.userOrigin;

	let projection = projectFetchable(
		state.snapshot,
		coverage,
		neededTiles,
		triggerTiles,
		activeKinds,
		origin,
		now
	);

	let pending: PendingFetch | null = overlapping;

	if (projection.missingTiles.size > 0 && overlapping !== null) {
		const releasedOverlapping = releasePending(overlapping, coverage);
		coverage = releasedOverlapping.coverage;
		effects.push(...releasedOverlapping.effects);
		pending = null;
		projection = projectFetchable(
			state.snapshot,
			coverage,
			neededTiles,
			triggerTiles,
			activeKinds,
			origin,
			now
		);
	}

	const { renders, missingTiles, missingKinds, reportableKinds } = projection;
	effects.push({ kind: 'render', layers: renders });

	let emptyAreaNotifiedAt = state.emptyAreaNotifiedAt;
	for (const render of renders) {
		if (!reportableKinds.has(render.kind)) {
			continue;
		}
		if (render.items.length > 0) {
			effects.push({ kind: 'track-area-explored' });
			effects.push({
				kind: 'report-nearest',
				layer: render.kind,
				nearest: nearestOf(render.items),
			});
		} else {
			effects.push({ kind: 'track-empty-area', layer: render.kind });
			if (canNotifyEmptyArea(emptyAreaNotifiedAt, render.kind, now)) {
				effects.push({
					kind: 'notify',
					request: { kind: 'toast', message: emptyAreaMessage(render.kind), tone: 'neutral' },
				});
				emptyAreaNotifiedAt = { ...emptyAreaNotifiedAt, [render.kind]: now };
			}
			effects.push({ kind: 'report-nearest', layer: render.kind, nearest: null });
		}
	}

	let nextRequest = state.nextRequest;

	if (missingTiles.size > 0 && missingKinds.size > 0 && state.connectivity === 'online') {
		const tiles = [...missingTiles];
		const kinds = [...missingKinds];
		const bounds = boundsOfTiles(tiles);
		if (bounds !== null) {
			const [request, issuedNextRequest] = issueRequestId(nextRequest);
			nextRequest = issuedNextRequest;
			for (const tile of tiles) {
				for (const kind of kinds) {
					coverage = markLoading(coverage, tile, kind, request);
				}
			}
			const loadingShown = !kinds.some((kind) => isKnown(state.snapshot, neededTiles, kind));
			if (loadingShown) {
				effects.push({ kind: 'show-loading' });
			}
			pending = { id: request, tiles, kinds, loadingShown };
			effects.push({ kind: 'start-fetch', request, tiles, kinds, bounds });
		}
	}

	effects.push(
		provenanceEffectOf(
			state.snapshot,
			coverage,
			neededTiles,
			activeKinds,
			state.sessionStartedAt,
			state.connectivity,
			now
		)
	);

	const nextState: SyncState = {
		...state,
		viewport,
		coverage,
		pending,
		nextRequest,
		zoomedOutNoticeShown: false,
		emptyAreaNotifiedAt,
	};
	return [nextState, effects];
};

const settle = (
	state: SyncState,
	now: Timestamp,
	nextViewport?: Viewport
): readonly [SyncState, readonly SyncEffect[]] => {
	const viewport = nextViewport ?? state.viewport;
	if (viewport === null) {
		return [state, []];
	}
	const classification = classify(viewport, MIN_FETCH_ZOOM);
	switch (classification.kind) {
		case 'zoomed-out':
			return settleZoomedOut(state, classification.viewport);
		case 'fetchable':
			return settleFetchable(state, classification.viewport, now);
		default: {
			const exhaustive: never = classification;
			return exhaustive;
		}
	}
};

const handleFetchSucceeded = (
	state: SyncState,
	event: Extract<SyncEvent, { readonly kind: 'fetch-succeeded' }>,
	now: Timestamp
): readonly [SyncState, readonly SyncEffect[]] => {
	const fetch = state.pending;
	if (fetch === null || fetch.id !== event.request) {
		return [state, []];
	}

	const reconciled = reconcile(state.snapshot, event.tiles, event.kinds, event.facilities, now);
	const evicted = evict(reconciled, FACILITY_CACHE_MAX_TILES);
	const coverage = clearMany(state.coverage, event.tiles, event.kinds);

	const [settled, settleEffects] = settle(
		{ ...state, snapshot: evicted, coverage, pending: null },
		now
	);
	const effects: SyncEffect[] = [{ kind: 'persist', snapshot: evicted }, ...settleEffects];
	if (fetch.loadingShown) {
		effects.push({ kind: 'hide-loading' });
	}
	return [settled, effects];
};

const handleFetchFailed = (
	state: SyncState,
	event: Extract<SyncEvent, { readonly kind: 'fetch-failed' }>,
	now: Timestamp
): readonly [SyncState, readonly SyncEffect[]] => {
	const fetch = state.pending;
	if (fetch === null || fetch.id !== event.request) {
		return [state, []];
	}

	const retryAfter = (now + FETCH_RETRY_BACKOFF_MS) as Timestamp;
	let coverage = state.coverage;
	for (const tile of fetch.tiles) {
		for (const kind of fetch.kinds) {
			coverage = markFailed(coverage, tile, kind, retryAfter);
		}
	}

	const notifyEffects: SyncEffect[] = [];
	const classification = state.viewport === null ? null : classify(state.viewport, MIN_FETCH_ZOOM);
	if (
		state.connectivity === 'online' &&
		classification !== null &&
		classification.kind === 'fetchable'
	) {
		const neededTiles = neededTilesOf(classification.viewport);
		const somethingKnown = fetch.kinds.some((kind) => isKnown(state.snapshot, neededTiles, kind));
		if (somethingKnown) {
			notifyEffects.push({
				kind: 'notify',
				request: { kind: 'toast', message: OFFLINE_SHOWING_SAVED_MESSAGE, tone: 'warning' },
			});
		} else {
			const [firstFailedKind] = fetch.kinds;
			if (firstFailedKind !== undefined) {
				notifyEffects.push({
					kind: 'notify',
					request: {
						kind: 'toast',
						message: fetchErrorMessage(firstFailedKind, event.error),
						tone: 'error',
					},
				});
			}
		}
	}

	const [settled, settleEffects] = settle({ ...state, coverage, pending: null }, now);
	const effects: SyncEffect[] = [];
	if (fetch.loadingShown) {
		effects.push({ kind: 'hide-loading' });
	}
	effects.push(...notifyEffects, ...settleEffects);
	return [settled, effects];
};

const connectivityNotices = (connectivity: Connectivity): readonly SyncEffect[] => {
	switch (connectivity) {
		case 'offline':
			return [
				{
					kind: 'notify',
					request: { kind: 'status', message: OFFLINE_STATUS_MESSAGE, tone: 'warning' },
				},
			];
		case 'online':
			return [
				{ kind: 'clear-status' },
				{
					kind: 'notify',
					request: { kind: 'toast', message: BACK_ONLINE_MESSAGE, tone: 'success' },
				},
			];
		default: {
			const exhaustive: never = connectivity;
			return exhaustive;
		}
	}
};

const handleConnectivityChanged = (
	state: SyncState,
	event: Extract<SyncEvent, { readonly kind: 'connectivity-changed' }>,
	now: Timestamp
): readonly [SyncState, readonly SyncEffect[]] => {
	if (event.connectivity === state.connectivity) {
		return [state, []];
	}

	if (event.connectivity === 'offline') {
		const released = releasePending(state.pending, state.coverage);
		const [settled, settleEffects] = settle(
			{ ...state, connectivity: 'offline', coverage: released.coverage, pending: null },
			now
		);
		return [settled, [...released.effects, ...connectivityNotices('offline'), ...settleEffects]];
	}

	const [settled, settleEffects] = settle({ ...state, connectivity: 'online' }, now);
	const effects: SyncEffect[] = [...connectivityNotices('online'), ...settleEffects];
	return [settled, effects];
};

export const apply = (
	state: SyncState,
	event: SyncEvent,
	now: Timestamp
): readonly [SyncState, readonly SyncEffect[]] => {
	switch (event.kind) {
		case 'viewport-settled':
			return settle(state, now, event.viewport);
		case 'cache-ready': {
			const hadAnyTiles = Object.keys(state.snapshot.tiles).length > 0;
			const merged = mergeSnapshots(event.snapshot, state.snapshot);
			const [settled, settleEffects] = settle({ ...state, snapshot: merged }, now);
			const effects: SyncEffect[] = hadAnyTiles
				? [{ kind: 'persist', snapshot: merged }, ...settleEffects]
				: [...settleEffects];
			return [settled, effects];
		}
		case 'layer-toggled':
			return settle({ ...state, layers: { ...state.layers, [event.layer]: event.active } }, now);
		case 'origin-moved':
			return settle({ ...state, userOrigin: event.position }, now);
		case 'fetch-succeeded':
			return handleFetchSucceeded(state, event, now);
		case 'fetch-failed':
			return handleFetchFailed(state, event, now);
		case 'connectivity-changed':
			return handleConnectivityChanged(state, event, now);
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
};
