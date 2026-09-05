/**
 * Distance enrichment
 * Facilities never carry distances themselves; a Located<F> pairs a facility with
 * its distance from a reference point (user location or map centre).
 */

import type { Facility } from './facility';
import type { LatLon, Meters } from './geo';
import { distanceBetween } from './geo';

/**
 * A facility together with its distance from a reference point
 */
export type Located<F extends Facility = Facility> = {
	readonly facility: F;
	readonly distance: Meters;
	readonly isNearest: boolean;
};

/**
 * Pair every facility with its distance from `origin`. No facility is flagged nearest.
 */
export const withDistances = <F extends Facility>(
	facilities: readonly F[],
	origin: LatLon
): readonly Located<F>[] =>
	facilities.map((facility) => ({
		facility,
		distance: distanceBetween(origin, facility.coordinates),
		isNearest: false,
	}));

/**
 * Index of the entry with the smallest distance (first one wins on ties), or -1 when empty
 */
const nearestIndex = (located: readonly Located<Facility>[]): number => {
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

/**
 * Flag exactly one entry (the closest) as nearest, clearing the flag on all others
 */
export const markNearest = <F extends Facility>(
	located: readonly Located<F>[]
): readonly Located<F>[] => {
	const index = nearestIndex(located);
	return located.map((item, i) => ({ ...item, isNearest: i === index }));
};

/**
 * The entry flagged as nearest, if any
 */
export const nearestOf = <F extends Facility>(located: readonly Located<F>[]): Located<F> | null =>
	located.find((item) => item.isNearest) ?? null;

/**
 * The facility closest to `origin`, or null when the list is empty
 */
export const findNearest = <F extends Facility>(
	facilities: readonly F[],
	origin: LatLon
): F | null => {
	const located = withDistances(facilities, origin);
	const index = nearestIndex(located);
	return index === -1 ? null : (located[index]?.facility ?? null);
};
