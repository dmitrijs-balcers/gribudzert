/**
 * API Contract: Layer State Management
 *
 * State tracking for facility layers
 */

/**
 * State for all facility layers
 */
export type LayerState = {
  readonly water: LayerInfo;
  readonly toilet: LayerInfo;
};

/**
 * Information about a single layer
 */
export type LayerInfo = {
  readonly visible: boolean;     // Layer is currently visible
  readonly loading: boolean;     // Data is being fetched
  readonly error: string | null; // Error message if fetch failed
  readonly lastUpdated: number | null; // Timestamp of last successful fetch
};

/**
 * Layer control actions
 */
export type LayerAction =
  | { type: 'SHOW_LAYER'; layer: LayerType }
  | { type: 'HIDE_LAYER'; layer: LayerType }
  | { type: 'LOADING_START'; layer: LayerType }
  | { type: 'LOADING_SUCCESS'; layer: LayerType; timestamp: number }
  | { type: 'LOADING_ERROR'; layer: LayerType; error: string };

export type LayerType = 'water' | 'toilet';

/**
 * Initial layer state (water visible by default, toilet hidden)
 */
export const initialLayerState: LayerState = {
  water: {
    visible: true,
    loading: false,
    error: null,
    lastUpdated: null,
  },
  toilet: {
    visible: false,
    loading: false,
    error: null,
    lastUpdated: null,
  },
};

/**
 * Layer state reducer (for potential future state management)
 */
export function layerReducer(state: LayerState, action: LayerAction): LayerState {
  const layer = action.layer;

  switch (action.type) {
    case 'SHOW_LAYER':
      return {
        ...state,
        [layer]: { ...state[layer], visible: true },
      };

    case 'HIDE_LAYER':
      return {
        ...state,
        [layer]: { ...state[layer], visible: false },
      };

    case 'LOADING_START':
      return {
        ...state,
        [layer]: { ...state[layer], loading: true, error: null },
      };

    case 'LOADING_SUCCESS':
      return {
        ...state,
        [layer]: {
          ...state[layer],
          loading: false,
          error: null,
          lastUpdated: action.timestamp,
        },
      };

    case 'LOADING_ERROR':
      return {
        ...state,
        [layer]: {
          ...state[layer],
          loading: false,
          error: action.error,
        },
      };

    default:
      return state;
  }
}

