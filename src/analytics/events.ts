import type { LayerName } from '../core/config';
import type { LocationFailureCategory } from '../types/errors';
import { debounce } from './debounce';
import { safeTrack } from './tracker';
import type { FacilityType, LocationType } from './types';

const AREA_EXPLORED_DEBOUNCE_MS = 2000;

export const trackMapLoaded = (locationType: LocationType): void => {
	safeTrack('map_loaded', { location_type: locationType });
};

export const trackMarkerClicked = (facilityType: FacilityType): void => {
	safeTrack('marker_clicked', { facility_type: facilityType });
};

export const trackNavigationStarted = (facilityType: FacilityType): void => {
	safeTrack('navigation_started', { facility_type: facilityType });
};

export const trackLayerEnabled = (layerName: LayerName, activeLayerCount: number): void => {
	safeTrack('layer_enabled', {
		layer_name: layerName,
		active_count: activeLayerCount,
	});
};

export const trackLayerDisabled = (layerName: LayerName, activeLayerCount: number): void => {
	safeTrack('layer_disabled', {
		layer_name: layerName,
		active_count: activeLayerCount,
	});
};

export const trackLocateRequested = (): void => {
	safeTrack('locate_requested');
};

export const trackLocateSuccess = (): void => {
	safeTrack('locate_success');
};

export const trackLocateFailed = (reason: LocationFailureCategory): void => {
	safeTrack('locate_failed', { reason });
};

const trackAreaExploredOnce = (): void => {
	safeTrack('area_explored');
};

export const trackAreaExplored = debounce(trackAreaExploredOnce, AREA_EXPLORED_DEBOUNCE_MS);

export const trackEmptyArea = (facilityType: FacilityType): void => {
	safeTrack('empty_area', { facility_type: facilityType });
};

export const trackInstallPromptShown = (): void => {
	safeTrack('install_prompt_shown');
};

export const trackInstallPromptAccepted = (): void => {
	safeTrack('install_prompt_accepted');
};

export const trackInstallPromptDismissed = (): void => {
	safeTrack('install_prompt_dismissed');
};
