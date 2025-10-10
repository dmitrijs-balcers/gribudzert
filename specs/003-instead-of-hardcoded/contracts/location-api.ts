/**
 * API Contracts: Location-Based Map Initialization
 *
 * This file defines TypeScript interfaces and types for the location detection
 * and dynamic water point fetching feature. These contracts ensure type safety
 * across the feature implementation.
 *
 * @module contracts/location-api
 */

import type * as L from 'leaflet';
import type { Element } from '../../../src/types/overpass';
import type { Result } from '../../../src/types/result';

// ============================================================================
// Location Permission & Detection
// ============================================================================

/**
 * Represents the state of location permission and detection process.
 * Uses discriminated union for exhaustive type checking.
 */
export type LocationPermissionState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'granted'; readonly position: GeolocationPosition }
  | { readonly kind: 'denied'; readonly reason: DenialReason }
  | { readonly kind: 'timeout' };

/**
 * Reasons why location permission might be denied
 */
export type DenialReason = 'user-denied' | 'unavailable';

/**
 * Typed errors for location detection failures
 */
export type LocationError =
  | { readonly type: 'permission-denied'; readonly message: string }
  | { readonly type: 'position-unavailable'; readonly message: string }
  | { readonly type: 'timeout'; readonly message: string }
  | { readonly type: 'not-supported'; readonly message: string };

/**
 * Simplified location coordinates
 */
export interface LocationCoordinates {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number;
}

// ============================================================================
// Location Detection API
// ============================================================================

/**
 * Detects user's initial location on page load
 *
 * @returns Result containing position or location error
 * @example
 * const result = await detectInitialLocation();
 * if (isOk(result)) {
 *   const { latitude, longitude } = result.value.coords;
 *   centerMap(latitude, longitude);
 * } else {
 *   useFallbackLocation();
 * }
 */
export interface DetectInitialLocation {
  (): Promise<Result<GeolocationPosition, LocationError>>;
}

/**
 * Extracts coordinates from GeolocationPosition
 *
 * @param position - Browser geolocation position object
 * @returns Simplified coordinate object
 */
export interface ExtractCoordinates {
  (position: GeolocationPosition): LocationCoordinates;
}

/**
 * Checks if geolocation is supported in current context
 *
 * @returns true if navigator.geolocation is available
 */
export interface IsGeolocationSupported {
  (): boolean;
}

// ============================================================================
// Map Initialization
// ============================================================================

/**
 * Options for initializing the map with location
 */
export interface MapInitOptions {
  readonly containerId: string;
  readonly center: L.LatLngTuple;
  readonly zoom: number;
  readonly maxZoom?: number;
}

/**
 * Result of map initialization
 */
export interface MapInitResult {
  readonly map: L.Map;
  readonly initialBounds: L.LatLngBounds;
}

/**
 * Initializes map with user location or fallback
 *
 * @param options - Map initialization options
 * @returns Initialized map and bounds
 */
export interface InitializeMapWithLocation {
  (options: MapInitOptions): MapInitResult;
}

/**
 * Calculates appropriate zoom level based on location accuracy
 *
 * @param accuracy - Accuracy radius in meters
 * @returns Zoom level (0-19)
 */
export interface CalculateZoomFromAccuracy {
  (accuracy: number): number;
}

// ============================================================================
// Viewport & Bounds Management
// ============================================================================

/**
 * Checks if map has moved significantly to warrant refetch
 *
 * @param oldBounds - Previous viewport bounds
 * @param newBounds - Current viewport bounds
 * @param threshold - Movement threshold (0-1, default 0.25 = 25%)
 * @returns true if movement exceeds threshold
 */
export interface HasMovedSignificantly {
  (
    oldBounds: L.LatLngBounds,
    newBounds: L.LatLngBounds,
    threshold?: number
  ): boolean;
}

/**
 * Converts Leaflet bounds to Overpass API bbox string
 *
 * @param bounds - Leaflet LatLngBounds object
 * @returns Comma-separated bbox string: "south,west,north,east"
 */
export interface BoundsToBBox {
  (bounds: L.LatLngBounds): string;
}

// ============================================================================
// Water Points Fetching
// ============================================================================

/**
 * Fetches water points within specified bounds
 *
 * @param query - Overpass QL query template
 * @param bounds - Geographic bounding box
 * @returns Result containing water point elements or fetch error
 */
export interface FetchWaterPointsInBounds {
  (
    query: string,
    bounds: L.LatLngBounds
  ): Promise<Result<Element[], FetchError>>;
}

/**
 * Fetch error types
 */
export type FetchError =
  | { readonly type: 'network'; readonly message: string }
  | { readonly type: 'timeout'; readonly message: string }
  | { readonly type: 'parse'; readonly message: string };

// ============================================================================
// Distance Calculations
// ============================================================================

/**
 * Calculates great-circle distance between two points using Haversine formula
 *
 * @param lat1 - First point latitude in decimal degrees
 * @param lon1 - First point longitude in decimal degrees
 * @param lat2 - Second point latitude in decimal degrees
 * @param lon2 - Second point longitude in decimal degrees
 * @returns Distance in meters
 */
export interface HaversineDistance {
  (lat1: number, lon1: number, lat2: number, lon2: number): number;
}

/**
 * Extended water point with distance information
 */
export interface WaterPointWithDistance extends Element {
  readonly distanceFromUser: number;
  readonly isNearest: boolean;
}

/**
 * Finds nearest water point to user location
 *
 * @param userLat - User latitude
 * @param userLon - User longitude
 * @param points - Array of water point elements
 * @returns Nearest water point or null if empty array
 */
export interface FindNearestWaterPoint {
  (
    userLat: number,
    userLon: number,
    points: Element[]
  ): WaterPointWithDistance | null;
}

/**
 * Calculates distances for all water points from user location
 *
 * @param userLat - User latitude
 * @param userLon - User longitude
 * @param points - Array of water point elements
 * @returns Array of water points with distance information
 */
export interface CalculateDistances {
  (
    userLat: number,
    userLon: number,
    points: Element[]
  ): WaterPointWithDistance[];
}

// ============================================================================
// Map Navigation Events
// ============================================================================

/**
 * Callback function when map bounds change significantly
 */
export type BoundsChangeCallback = (bounds: L.LatLngBounds) => void;

/**
 * Options for map navigation handler setup
 */
export interface NavigationHandlerOptions {
  readonly debounceMs?: number;
  readonly movementThreshold?: number;
}

/**
 * Sets up event handlers for map navigation (pan/zoom)
 *
 * @param map - Leaflet map instance
 * @param onBoundsChange - Callback when bounds change significantly
 * @param options - Configuration options
 * @returns Cleanup function to remove handlers
 */
export interface SetupMapNavigationHandlers {
  (
    map: L.Map,
    onBoundsChange: BoundsChangeCallback,
    options?: NavigationHandlerOptions
  ): () => void;
}

// ============================================================================
// Marker Enhancement
// ============================================================================

/**
 * Options for styling the nearest marker
 */
export interface NearestMarkerStyle {
  readonly radius?: number;
  readonly color?: string;
  readonly weight?: number;
  readonly fillOpacity?: number;
}

/**
 * Applies special styling to nearest water point marker
 *
 * @param marker - Leaflet circle marker
 * @param distance - Distance in meters from user
 * @param style - Optional custom style
 */
export interface HighlightNearestMarker {
  (
    marker: L.CircleMarker,
    distance: number,
    style?: NearestMarkerStyle
  ): void;
}

/**
 * Formats distance for display in popup
 *
 * @param meters - Distance in meters
 * @returns Formatted string (e.g., "150 m" or "1.2 km")
 */
export interface FormatDistance {
  (meters: number): string;
}

// ============================================================================
// Application Flow
// ============================================================================

/**
 * Complete initialization flow result
 */
export interface InitializationFlowResult {
  readonly map: L.Map;
  readonly location: LocationCoordinates | null;
  readonly waterPoints: WaterPointWithDistance[];
  readonly nearestPoint: WaterPointWithDistance | null;
}

/**
 * Executes complete app initialization with location detection
 *
 * This orchestrates the entire flow:
 * 1. Detect user location (or fallback)
 * 2. Initialize map centered on location
 * 3. Fetch water points in viewport
 * 4. Calculate nearest point
 * 5. Render markers
 *
 * @param containerId - HTML element ID for map
 * @returns Result containing initialization data or error
 */
export interface ExecuteInitializationFlow {
  (containerId: string): Promise<Result<InitializationFlowResult, LocationError>>;
}

