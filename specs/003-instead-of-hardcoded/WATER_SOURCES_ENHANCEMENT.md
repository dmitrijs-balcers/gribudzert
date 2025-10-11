# Water Sources Enhancement

**Date**: 2025-10-12  
**Feature**: Expanded water source types with color coding  
**Related**: [spec.md](./spec.md), [tasks.md](./tasks.md)

## Overview

Enhanced the application to display multiple types of drinking water sources beyond just "amenity=drinking_water", with color-coded markers and user-friendly labels to distinguish between different water source types.

## Changes Implemented

### 1. Expanded Overpass Query (`src/oql/drinking_water.overpassql`)

The query now searches for **5 different water source types**:

- **Natural Springs** (`natural=spring`)
- **Water Wells** (`man_made=water_well`)
- **Water Taps** (`man_made=water_tap`)
- **Drinking Water Amenities** (`amenity=drinking_water`)
- **Water Points** (`waterway=water_point`)

Both nodes and relations are searched for each type, significantly increasing coverage of available drinking water sources.

### 2. Color Coding System (`src/features/markers/markers.ts`)

Each water source type has a distinct color for easy identification:

| Water Source Type | Color | Hex Code | Icon |
|------------------|-------|----------|------|
| Natural Spring | Cyan | `#00BCD4` | 💧 |
| Water Well | Brown | `#795548` | 🪣 |
| Water Tap | Blue | `#2196F3` | 🚰 |
| Water Point | Teal | `#009688` | 🌊 |
| Drinking Water | Green | `#4CAF50` | 🚰 |

The color priority is: **Source Type > Colour Tag > Default**

### 3. Enhanced Popup Content (`src/features/markers/popup.ts`)

Popups now display:
- **Water source type** with icon and color-coded label
- **Element ID** in a subtle font
- **Distance** (when available)
- **Nearest marker indicator** (⭐ for closest point)
- **All existing tags** (operator, note, seasonal, bottle refill, wheelchair access)
- **Navigation button** with type-specific aria-label
- **OpenStreetMap link**

Example popup title:
```
🚰 Water Tap
ID: 123456789
Distance: 150m
```

### 4. Test Updates

Updated test suite to expect new user-friendly labels:
- Changed assertions from `"water_tap"` to `"Drinking Water"`
- Updated aria-label expectations to include water source type
- All 239 tests passing ✅

## Benefits

1. **More Water Sources**: Users can now find 5x more types of drinking water locations
2. **Better Distinction**: Color coding makes it easy to identify water source types at a glance
3. **Improved UX**: User-friendly labels instead of technical OSM tags
4. **Accessibility**: Icons and color-coded text improve visual comprehension
5. **Maintained Quality**: All existing tests updated and passing

## Testing

### Automated Tests
✅ All 239 tests passing  
✅ No linter warnings  
✅ TypeScript compilation successful

### Manual Testing Checklist

To verify the enhancement works correctly:

- [ ] Open the app and verify multiple colored markers appear
- [ ] Click different markers to see various water source types
- [ ] Verify natural springs show as cyan (💧 Natural Spring)
- [ ] Verify water wells show as brown (🪣 Water Well)
- [ ] Verify water taps show as blue (🚰 Water Tap)
- [ ] Verify water points show as teal (🌊 Water Point)
- [ ] Verify drinking water amenities show as green (🚰 Drinking Water)
- [ ] Verify the nearest marker still highlights in gold
- [ ] Verify distance calculations still work correctly
- [ ] Verify pan/zoom triggers refetch of all water source types

## Future Enhancements

Potential improvements for future iterations:

1. **Legend**: Add a map legend showing what each color represents
2. **Filtering**: Allow users to filter by water source type
3. **Preferences**: Let users enable/disable specific water source types
4. **Statistics**: Show count of each water source type in current view
5. **Photos**: Integrate photos from OpenStreetMap for water sources

## Technical Notes

- The color coding function uses a priority system: source type first, then falls back to the `colour` tag, then default
- The query timeout is set to 25 seconds to handle larger result sets
- Relations are included in addition to nodes to capture complex water features
- All color codes use Material Design color palette for consistency

