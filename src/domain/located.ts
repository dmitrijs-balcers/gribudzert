import type { Facility } from './facility';
import { facilityId } from './facility';
import type { LatLon, Meters } from './geo';
import { distanceBetween } from './geo';

export type Located<F extends Facility = Facility> = {
	readonly facility: F;
	readonly distance: Meters;
	readonly isNearest: boolean;
};

export const withDistances = <F extends Facility>(
	facilities: readonly F[],
	origin: LatLon
): readonly Located<F>[] =>
	facilities.map((facility) => ({
		facility,
		distance: distanceBetween(origin, facility.coordinates),
		isNearest: false,
	}));

const firstNearestIndex = (located: readonly Located<Facility>[]): number => {
	let bestIndex = -1;
	let bestDistance = Number.POSITIVE_INFINITY;
	located.forEach((item, index) => {
		if (item.distance < bestDistance) {
			bestDistance = item.distance;
			bestIndex = index;
		}
	});
	return bestIndex;
};

export const markNearest = <F extends Facility>(
	located: readonly Located<F>[]
): readonly Located<F>[] => {
	const index = firstNearestIndex(located);
	return located.map((item, i) => ({ ...item, isNearest: i === index }));
};

export const nearestOf = <F extends Facility>(located: readonly Located<F>[]): Located<F> | null =>
	located.find((item) => item.isNearest) ?? null;

export const findNearest = <F extends Facility>(
	facilities: readonly F[],
	origin: LatLon
): F | null => {
	const located = withDistances(facilities, origin);
	const index = firstNearestIndex(located);
	return index === -1 ? null : (located[index]?.facility ?? null);
};

export const sameLocated = (a: Located<Facility>, b: Located<Facility>): boolean =>
	facilityId(a.facility.osm) === facilityId(b.facility.osm) &&
	a.distance === b.distance &&
	a.isNearest === b.isNearest;

export const sameLocatedList = (
	a: readonly Located<Facility>[],
	b: readonly Located<Facility>[]
): boolean =>
	a.length === b.length &&
	a.every((item, index) => {
		const other = b[index];
		return other !== undefined && sameLocated(item, other);
	});
