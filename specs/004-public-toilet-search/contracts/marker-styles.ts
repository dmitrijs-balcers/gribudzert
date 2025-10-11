/**
 * API Contract: Marker Styling
 *
 * Generic marker styling configuration
 */

/**
 * Marker visual style configuration
 */
export type MarkerStyle = {
  readonly color: string;        // Border color (hex code)
  readonly fillColor: string;    // Fill color (hex code)
  readonly radius: number;       // Marker radius in pixels
  readonly weight: number;       // Border weight in pixels
  readonly fillOpacity: number;  // Fill opacity (0-1)
  readonly iconType?: MarkerIconType; // Marker shape variant
};

/**
 * Marker icon type variants
 */
export type MarkerIconType =
  | 'circle'        // Standard circle marker
  | 'crossed'       // Circle with X (for non-drinkable water)
  | 'custom';       // Custom SVG icon

/**
 * Factory function signature for creating marker styles
 */
export type StyleFactory<T> = (element: T, options?: StyleOptions) => MarkerStyle;

/**
 * Options for style generation
 */
export type StyleOptions = {
  readonly isNearest?: boolean;    // Highlight as nearest point
  readonly isSeasonal?: boolean;   // Reduced opacity for seasonal
  readonly isHighlighted?: boolean; // User-selected highlight
};

/**
 * Color palette for facility types
 */
export const FacilityColors = {
  // Water source colors (blue spectrum)
  water: {
    drinkingWater: '#4CAF50',  // Green - drinking water amenity
    spring: '#00BCD4',          // Cyan - natural spring
    waterWell: '#795548',       // Brown - water well
    waterTap: '#2196F3',        // Blue - water tap
    waterPoint: '#009688',      // Teal - water point
    nonDrinkable: '#FF5722',    // Deep Orange - non-drinkable warning
    default: '#0078ff',         // Default blue
  },

  // Toilet colors (brown/tan spectrum)
  toilet: {
    accessible: '#8D6E63',      // Brown - accessible toilet
    standard: '#A1887F',        // Light brown - standard toilet
    premium: '#6D4C41',         // Dark brown - premium/paid toilet
    default: '#795548',         // Default brown
  },

  // UI colors
  ui: {
    nearest: '#FFD700',         // Gold - nearest marker highlight
    selected: '#FF9800',        // Orange - user selected
    disabled: '#9E9E9E',        // Grey - disabled/closed
  },
} as const;

/**
 * Default marker radii
 */
export const MarkerRadius = {
  default: 6,
  bottle: 8,      // Bottle refill available
  wheelchair: 8,  // Wheelchair accessible
  highlighted: 9, // Nearest or selected
} as const;

/**
 * Helper: Validate hex color code
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Helper: Create marker style with defaults
 */
export function createMarkerStyle(overrides: Partial<MarkerStyle>): MarkerStyle {
  return {
    color: '#333',
    fillColor: '#0078ff',
    radius: MarkerRadius.default,
    weight: 2,
    fillOpacity: 0.6,
    iconType: 'circle',
    ...overrides,
  };
}

