import type * as L from 'leaflet';
import { point as leafletPoint } from 'leaflet';
import type { GesturePoint } from './gesture';

export type ContinuousZoom = {
	readonly start: (anchor: GesturePoint) => void;
	readonly zoomTo: (zoom: number) => void;
	readonly finish: () => void;
};

type LeafletPinchInternals = {
	readonly _stop: () => void;
	readonly _limitZoom: (zoom: number) => number;
	readonly _moveStart: (zoomChanged: boolean, noMoveStart: boolean) => void;
	readonly _move: (
		center: L.LatLng,
		zoom: number,
		data: { readonly pinch: boolean; readonly round: boolean }
	) => void;
	readonly _animateZoom: (
		center: L.LatLng,
		zoom: number,
		startAnim: boolean,
		noUpdate: boolean | number | undefined
	) => void;
	readonly _resetView: (center: L.LatLng, zoom: number) => void;
};

type Session = {
	readonly anchor: L.Point;
	readonly anchorLatLng: L.LatLng;
	readonly centerPoint: L.Point;
	moved: boolean;
	target: { readonly center: L.LatLng; readonly zoom: number } | null;
	frame: number | null;
};

export const createContinuousZoom = (map: L.Map): ContinuousZoom => {
	const internals = map as unknown as LeafletPinchInternals;
	let session: Session | null = null;

	const centerKeepingAnchor = (current: Session, zoom: number): L.LatLng => {
		const offset = current.anchor.subtract(current.centerPoint);
		return map.unproject(map.project(current.anchorLatLng, zoom).subtract(offset), zoom);
	};

	const scaleTilesLikePinch = (center: L.LatLng, zoom: number): void => {
		internals._move(center, zoom, { pinch: true, round: false });
	};

	const commitZoomLikePinchEnd = (center: L.LatLng, zoom: number): void => {
		if (map.options.zoomAnimation) {
			internals._animateZoom(center, zoom, true, map.options.zoomSnap);
		} else {
			internals._resetView(center, zoom);
		}
	};

	const applyFrame = (): void => {
		if (session === null) {
			return;
		}
		session.frame = null;
		if (session.target === null) {
			return;
		}
		if (!session.moved) {
			session.moved = true;
			internals._moveStart(true, false);
		}
		scaleTilesLikePinch(session.target.center, session.target.zoom);
	};

	return {
		start: (anchor) => {
			const anchorPoint = leafletPoint(anchor.x, anchor.y);
			internals._stop();
			session = {
				anchor: anchorPoint,
				anchorLatLng: map.containerPointToLatLng(anchorPoint),
				centerPoint: map.getSize().divideBy(2),
				moved: false,
				target: null,
				frame: null,
			};
		},
		zoomTo: (zoom) => {
			if (session === null) {
				return;
			}
			const limited = internals._limitZoom(zoom);
			session.target = { center: centerKeepingAnchor(session, limited), zoom: limited };
			if (session.frame === null) {
				session.frame = requestAnimationFrame(applyFrame);
			}
		},
		finish: () => {
			if (session === null) {
				return;
			}
			const ending = session;
			session = null;
			if (ending.frame !== null) {
				cancelAnimationFrame(ending.frame);
			}
			if (!ending.moved || ending.target === null) {
				return;
			}
			const { center, zoom } = ending.target;
			commitZoomLikePinchEnd(center, zoom);
		},
	};
};
