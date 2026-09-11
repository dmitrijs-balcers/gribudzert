import * as L from 'leaflet';
import { describe, expect, it } from 'vitest';
import type { Facility, FacilityId, Located } from '../../src/domain';
import { coordinates, facilityFromTags, facilityId, withDistances } from '../../src/domain';
import type { MarkerGroups, MarkerRenderer } from '../../src/features/markers';
import { createMarkerRenderer, SELECTED_MARKER_CLASS } from '../../src/features/markers';
import { USER } from '../fixtures';
import { MAP_HEIGHT, MAP_WIDTH } from '../setup';

const SELECTED_Z_OFFSET = 1000;

const waterAt = (id: number, lat: number, lon: number): Facility => {
	const position = coordinates(lat, lon);
	if (position === null) {
		throw new Error('invalid test coordinates');
	}
	const facility = facilityFromTags({ type: 'node', id }, position, { amenity: 'drinking_water' });
	if (facility === null) {
		throw new Error(`node ${id} is not a facility`);
	}
	return facility;
};

const toiletAt = (id: number, lat: number, lon: number): Facility => {
	const position = coordinates(lat, lon);
	if (position === null) {
		throw new Error('invalid test coordinates');
	}
	const facility = facilityFromTags({ type: 'node', id }, position, { amenity: 'toilets' });
	if (facility === null) {
		throw new Error(`node ${id} is not a facility`);
	}
	return facility;
};

const idOf = (id: number): FacilityId => facilityId({ type: 'node', id });

const locate = (facilities: readonly Facility[]): readonly Located<Facility>[] =>
	withDistances(facilities, USER);

const sizedContainer = (): HTMLDivElement => {
	const container = document.createElement('div');
	Object.defineProperty(container, 'clientWidth', { configurable: true, value: MAP_WIDTH });
	Object.defineProperty(container, 'clientHeight', { configurable: true, value: MAP_HEIGHT });
	return container;
};

type Scene = {
	readonly map: L.Map;
	readonly groups: MarkerGroups;
	readonly renderer: MarkerRenderer;
	readonly markersOf: (kind: keyof MarkerGroups) => readonly L.Marker[];
};

const scene = (): Scene => {
	const map = L.map(sizedContainer(), {
		center: [USER.lat, USER.lon],
		zoom: 15,
		zoomControl: false,
		attributionControl: false,
	});
	const groups: MarkerGroups = {
		water: L.featureGroup<L.Marker>().addTo(map),
		toilet: L.featureGroup<L.Marker>().addTo(map),
		viewpoint: L.featureGroup<L.Marker>().addTo(map),
	};
	const renderer = createMarkerRenderer(groups, { onSelect: () => undefined });
	return {
		map,
		groups,
		renderer,
		markersOf: (kind) =>
			groups[kind].getLayers().filter((layer): layer is L.Marker => layer instanceof L.Marker),
	};
};

const isHighlighted = (marker: L.Marker): boolean =>
	marker.options.zIndexOffset === SELECTED_Z_OFFSET &&
	(marker.getElement()?.classList.contains(SELECTED_MARKER_CLASS) ?? false);

describe('createMarkerRenderer', () => {
	it('keeps existing markers when a kind re-renders with an unchanged list', () => {
		const { renderer, markersOf } = scene();
		const items = locate([waterAt(1, 56.954, 24.118), waterAt(2, 56.9525, 24.1125)]);

		renderer.render([{ kind: 'water', items }]);
		const before = markersOf('water');
		renderer.render([{ kind: 'water', items: [...items] }]);

		expect(markersOf('water')).toEqual(before);
		expect(before).toHaveLength(2);
	});

	it('replaces markers when the list changes', () => {
		const { renderer, markersOf } = scene();
		renderer.render([{ kind: 'water', items: locate([waterAt(1, 56.954, 24.118)]) }]);
		const before = markersOf('water');

		renderer.render([
			{ kind: 'water', items: locate([waterAt(1, 56.954, 24.118), waterAt(2, 56.9525, 24.1125)]) },
		]);

		const after = markersOf('water');
		expect(after).toHaveLength(2);
		expect(after).not.toContain(before[0]);
	});

	it('highlights the selected facility by id even when two facilities share coordinates', () => {
		const { renderer, markersOf } = scene();
		const items = locate([waterAt(1, 56.954, 24.118), waterAt(2, 56.954, 24.118)]);
		renderer.render([{ kind: 'water', items }]);

		renderer.select(idOf(2));

		const [first, second] = markersOf('water');
		expect(first !== undefined && isHighlighted(first)).toBe(false);
		expect(second !== undefined && isHighlighted(second)).toBe(true);
	});

	it('moves the highlight when another facility is selected and clears it on null', () => {
		const { renderer, markersOf } = scene();
		renderer.render([
			{ kind: 'water', items: locate([waterAt(1, 56.954, 24.118)]) },
			{ kind: 'toilet', items: locate([toiletAt(3, 56.9515, 24.115)]) },
		]);

		renderer.select(idOf(1));
		renderer.select(idOf(3));
		expect(markersOf('water').some(isHighlighted)).toBe(false);
		expect(markersOf('toilet').some(isHighlighted)).toBe(true);

		renderer.select(null);
		expect(markersOf('toilet').some(isHighlighted)).toBe(false);
	});

	it('keeps the selected facility highlighted after its marker is re-created by a render', () => {
		const { renderer, markersOf } = scene();
		renderer.render([{ kind: 'water', items: locate([waterAt(1, 56.954, 24.118)]) }]);
		renderer.select(idOf(1));

		renderer.render([
			{ kind: 'water', items: locate([waterAt(1, 56.954, 24.118), waterAt(2, 56.9525, 24.1125)]) },
		]);

		const [first, second] = markersOf('water');
		expect(first !== undefined && isHighlighted(first)).toBe(true);
		expect(second !== undefined && isHighlighted(second)).toBe(false);
	});

	it('forgets a cleared kind so the same list renders fresh markers again', () => {
		const { renderer, markersOf } = scene();
		const water = locate([waterAt(1, 56.954, 24.118)]);
		const toilet = locate([toiletAt(3, 56.9515, 24.115)]);
		renderer.render([
			{ kind: 'water', items: water },
			{ kind: 'toilet', items: toilet },
		]);
		const toiletBefore = markersOf('toilet');

		renderer.clear('water');
		expect(markersOf('water')).toHaveLength(0);
		expect(markersOf('toilet')).toEqual(toiletBefore);

		renderer.render([{ kind: 'water', items: water }]);
		expect(markersOf('water')).toHaveLength(1);
	});

	it('clearAll empties every kind', () => {
		const { renderer, markersOf } = scene();
		renderer.render([
			{ kind: 'water', items: locate([waterAt(1, 56.954, 24.118)]) },
			{ kind: 'toilet', items: locate([toiletAt(3, 56.9515, 24.115)]) },
		]);

		renderer.clearAll();

		expect(markersOf('water')).toHaveLength(0);
		expect(markersOf('toilet')).toHaveLength(0);
	});
});
