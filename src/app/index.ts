/**
 * Application layer public API
 * Orchestration of map, layers, session and user interaction. Import from here.
 */

export { bootstrap, MAP_CONTAINER_ID } from './bootstrap';
export type { App, ExploreDeps, Viewport } from './explore';
export { canFetchAtZoom, defaultExploreDeps, exploreViewport, viewportOf } from './explore';
export type {
	AddMarkers,
	FacilityLayer,
	FacilityLayerGroup,
	FacilityLayers,
	FetchFacilities,
	LayerHost,
	LayerKind,
	LayerRefresh,
	RefreshDeps,
	RefreshError,
	RefreshOptions,
	RefreshOutcome,
	RefreshResult,
	RefreshSource,
} from './layers';
export {
	abortInflight,
	activeLayerCount,
	activeLayers,
	clearLayerMarkers,
	createFacilityLayer,
	createFacilityLayers,
	defaultRefreshDeps,
	disableLayer,
	enableLayer,
	isLayerName,
	LAYER_KINDS,
	labelOf,
	layerKindOf,
	locateFacilities,
	refreshLayers,
	renderCached,
} from './layers';
export {
	emptyAreaMessage,
	fetchErrorMessage,
	INITIALIZATION_FAILED_MESSAGE,
	LOCATION_FALLBACK_MESSAGE,
	OFFLINE_SHOWING_SAVED_MESSAGE,
	subjectOf,
	ZOOMED_OUT_MESSAGE,
} from './messages';
export type { AppState, Origin, OriginSource, Session } from './session';
export {
	canNotifyEmptyArea,
	createSession,
	initialState,
	resolveOrigin,
	withEmptyAreaNotified,
	withUserLocation,
	withZoomedOutNotice,
} from './session';
