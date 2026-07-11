/**
 * Small, dependency-free math helpers used throughout the simulation.
 * Kept separate so both the logic layer and the rendering layer can share them.
 */
import type { Vec2 } from './types';

/** Clamp `v` to the inclusive range [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Linear interpolation between a and b by t (0–1). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Frame-rate independent exponential smoothing.
 * `rate` is the approximate fraction of the gap closed per second.
 */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

/** Move `current` toward `target` by at most `maxDelta`. */
export function moveToward(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

/** Squared distance between two points (avoids a sqrt). */
export function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Euclidean distance between two points. */
export function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt(distSq(a, b));
}

/** Deterministic-ish pseudo random in [0,1) seeded by a mutable counter object. */
export function seededRandom(state: { seed: number }): number {
  // xorshift32 — cheap and good enough for AI jitter / particle variance.
  let x = state.seed | 0 || 0x1234abcd;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.seed = x;
  return ((x >>> 0) % 100000) / 100000;
}

/** Random float in [min, max). */
export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Random integer in [min, max]. */
export function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Pick a random element from an array. */
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
