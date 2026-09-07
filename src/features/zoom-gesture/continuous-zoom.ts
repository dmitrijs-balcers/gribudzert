import type * as L from 'leaflet';
import { point as leafletPoint } from 'leaflet';
import type { GesturePoint } from './gesture';

/**
 * Drives a continuous, anchored zoom the same way Leaflet's own pinch handler does.
 *
 * Leaflet's public `setZoomAround` performs a full view reset on every call: it aborts every
 * tile still loading, removes it and requests it again. Called once per pointer move that
 * leaves the map grey for the whole gesture. Pinch instead only scales the existing tiles
 * with a CSS transform while the fingers move (`_move` with `pinch: true`) and loads tiles
 * once, when the gesture ends. This module reuses that exact private path so the one-hand
 * gesture and pinch behave identically.
 */
export type ContinuousZoom = {
	/** Starts a zoom anchored on a container point: what is under it stays under it. */
	readonly start: (anchor: GesturePoint) => void;
	/** Requests a frame that scales the map to `zoom`. Ignored unless started. */
	readonly zoomTo: (zoom: number) => void;
	/** Commits the last requested zoom exactly as pinch does on lift. Ignored unless started. */
	readonly finish: () => void;
};

type LeafletMapInternals = {
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
	const internals = map as unknown as LeafletMapInternals;
	let session: Session | null = null;

	const centerKeepingAnchor = (current: Session, zoom: number): L.LatLng => {
		const offset = current.anchor.subtract(current.centerPoint);
		return map.unproject(map.project(current.anchorLatLng, zoom).subtract(offset), zoom);
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
		internals._move(session.target.center, session.target.zoom, { pinch: true, round: false });
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
			if (map.options.zoomAnimation) {
				internals._animateZoom(center, zoom, true, map.options.zoomSnap);
			} else {
				internals._resetView(center, zoom);
			}
		},
	};
};
