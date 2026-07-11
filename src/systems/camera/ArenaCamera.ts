/**
 * ArenaCamera — Smash-style dynamic framing.
 *
 * Given the live positions of all fighters, it computes a target focus point
 * and camera distance that keeps everyone comfortably on screen, then smoothly
 * interpolates toward it. The result is cinematic auto-zoom that stays readable
 * without ever clipping fighters off the edges.
 */
import type { Vec2 } from '@/core/types';
import { clamp, damp } from '@/core/math';

export interface CameraState {
  /** Current focus point (world XY). */
  focusX: number;
  focusY: number;
  /** Current camera distance along Z. */
  distance: number;
}

export interface CameraTuning {
  minDistance: number;
  maxDistance: number;
  /** Horizontal padding added around the fighters' bounding box. */
  paddingX: number;
  paddingY: number;
  /** Camera vertical aim offset (keeps action in the lower-middle). */
  yBias: number;
  /** Smoothing rate (higher = snappier). */
  smoothing: number;
  /** Assumed viewport aspect for fitting width vs height. */
  aspect: number;
}

export const DEFAULT_CAMERA_TUNING: CameraTuning = {
  minDistance: 16,
  maxDistance: 46,
  paddingX: 6,
  paddingY: 5,
  yBias: 1.5,
  smoothing: 3.2,
  aspect: 16 / 9,
};

export function createCameraState(): CameraState {
  return { focusX: 0, focusY: 3, distance: 24 };
}

/**
 * Advance the camera toward the framing that best fits `points`.
 * Mutates and returns `state`.
 */
export function updateCamera(
  state: CameraState,
  points: Vec2[],
  tuning: CameraTuning,
  dt: number,
): CameraState {
  if (points.length === 0) return state;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2 + tuning.yBias;

  // Required span, padded.
  const spanX = maxX - minX + tuning.paddingX * 2;
  const spanY = maxY - minY + tuning.paddingY * 2;

  // Distance needed to fit width vs height (rough perspective fit).
  const distForWidth = spanX / tuning.aspect;
  const distForHeight = spanY;
  const targetDistance = clamp(
    Math.max(distForWidth, distForHeight),
    tuning.minDistance,
    tuning.maxDistance,
  );

  state.focusX = damp(state.focusX, centreX, tuning.smoothing, dt);
  state.focusY = damp(state.focusY, centreY, tuning.smoothing, dt);
  state.distance = damp(state.distance, targetDistance, tuning.smoothing, dt);
  return state;
}
