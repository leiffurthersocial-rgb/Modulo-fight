/**
 * Global tuning constants for the Modulo Fight simulation.
 *
 * All values are in simulation units (roughly 1 unit ≈ 1 metre) and seconds.
 * Centralising them here keeps balancing in one place and out of logic files.
 */

/** Downward acceleration applied to airborne fighters (units/sec²). */
export const GRAVITY = 55;

/** Terminal fall speed so fighters never tunnel through platforms. */
export const MAX_FALL_SPEED = 40;

/** Horizontal ground acceleration toward the target velocity. */
export const GROUND_ACCEL = 90;

/** Horizontal air acceleration (less than ground for that floaty feel). */
export const AIR_ACCEL = 40;

/** Friction applied when no input is given on the ground. */
export const GROUND_FRICTION = 60;

/** Air drag applied when no input is given in the air. */
export const AIR_DRAG = 8;

/** Sprint multiplier applied to base speed while holding Sprint. */
export const SPRINT_MULTIPLIER = 1.55;

/** Fighter collision half-extents (roughly capsule-shaped voxel body). */
export const FIGHTER_HALF_WIDTH = 0.45;
export const FIGHTER_HALF_HEIGHT = 0.9;

/**
 * Effective body radius used when testing an attack capsule against a victim.
 * Sits between the body's half-width and half-height so hits that visually
 * clip any part of the torso register, without being so large that whiffs land.
 */
export const VICTIM_BODY_RADIUS = 0.6;

/** Duration of a dodge in seconds and its invulnerability window. */
export const DODGE_DURATION = 0.36;
export const DODGE_INVULN = 0.28;
export const DODGE_SPEED = 14;

/** Dash burst speed and duration. */
export const DASH_SPEED = 20;
export const DASH_DURATION = 0.18;

/** Hitstun scaling: seconds of stun per unit of knockback. */
export const HITSTUN_PER_KNOCKBACK = 0.012;

/**
 * Hitstop ("impact freeze") — on a confirmed hit the whole simulation pauses
 * for a few frames, scaled by the hit's power. This is the single biggest
 * game-feel lever in a fighter: it makes strikes land with weight. Kept short
 * so fast exchanges never feel sluggish.
 */
export const HITSTOP_BASE = 0.025;
export const HITSTOP_PER_POWER = 0.0022;
export const HITSTOP_MAX = 0.09;
export const HITSTOP_KO = 0.13;

/**
 * Directional Influence — while airborne in hitstun a fighter can nudge their
 * trajectory slightly by holding a direction, giving skilled players a chance
 * to survive knockback. Small on purpose so it never trivialises kills.
 */
export const DI_STRENGTH = 11;

/** Global knockback tuning — how sharply damage amplifies launch distance. */
export const KNOCKBACK_DAMAGE_SCALE = 0.9;

/** Damage that counts as a decayed combo reset window (seconds). */
export const COMBO_RESET_TIME = 1.1;

/**
 * Damage regeneration — after going untouched for `REGEN_DELAY` seconds a
 * fighter slowly sheds accumulated percentage at `REGEN_RATE` per second.
 *
 * This rewards successfully disengaging and softens a runaway snowball, without
 * ever being a reset: the delay is long enough that it never ticks during an
 * exchange, and the rate is slow enough that escaping a 120% deficit still
 * takes far longer than the opponent needs to re-engage. Any hit taken restarts
 * the delay from zero.
 */
export const REGEN_DELAY = 5;
export const REGEN_RATE = 2;

/** Shield can be held; it slowly leaks so it can't be held forever. */
export const SHIELD_MAX = 1;
export const SHIELD_DRAIN = 0.35;
export const SHIELD_REGEN = 0.22;

/** Default number of stocks (lives) per fighter. */
export const DEFAULT_STOCKS = 3;

/** Default match time limit in seconds (0 = no limit). */
export const DEFAULT_TIME_LIMIT = 180;

/** Fixed simulation timestep. The loop accumulates real time into these. */
export const FIXED_DT = 1 / 120;

/** Maximum simulation steps per frame to avoid the spiral of death. */
export const MAX_STEPS_PER_FRAME = 5;

/** Respawn platform height above stage centre after losing a stock. */
export const RESPAWN_Y = 8;

/** Seconds of spawn invulnerability after respawning. */
export const SPAWN_INVULN = 2.2;

/** Survive mode: fixed player lives so scores are comparable. */
export const SURVIVE_PLAYER_STOCKS = 3;

/** Survive mode: pause between defeating an opponent and the next spawning. */
export const SURVIVE_WAVE_DELAY = 0.9;
