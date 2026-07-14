/**
 * PhysicsSystem — kinematic platform-fighter movement.
 *
 * A platform fighter needs tight, predictable, frame-perfect movement rather
 * than the emergent behaviour of a rigid-body solver, so the character
 * controller is custom and deterministic. (Rapier remains available in the
 * stack for arena props and future destructible geometry.) Everything runs on
 * the 2D simulation plane; the renderer maps it into 3D.
 */
import type { ArenaConfig, Platform } from '@/core/types';
import {
  AIR_ACCEL,
  AIR_DRAG,
  FIGHTER_HALF_HEIGHT,
  FIGHTER_HALF_WIDTH,
  GRAVITY,
  GROUND_ACCEL,
  GROUND_FRICTION,
  MAX_FALL_SPEED,
  SPRINT_MULTIPLIER,
} from '@/core/constants';
import { moveToward } from '@/core/math';
import { debug } from '@/core/debug';
import type { InputFrame } from '@/systems/input/InputState';
import type { FighterRuntime } from '@/systems/simulation/FighterRuntime';

/** Apply horizontal intent, gravity and jumping to a fighter's velocity. */
export function integrateMovement(
  f: FighterRuntime,
  input: InputFrame,
  dt: number,
  canAct: boolean,
): void {
  const stats = f.config.stats;

  // --- Horizontal control -------------------------------------------------
  if (canAct && !f.shielding) {
    const runSpeedBonus = f.config.passive === 'runSpeed' ? 1.12 : 1;
    const sprint = input.sprint ? SPRINT_MULTIPLIER : 1;
    const targetVx = input.moveX * stats.speed * runSpeedBonus * sprint;
    // Air control varies per fighter (acrobats steer hard, heavies drift).
    const airAccel = AIR_ACCEL * (stats.airControl ?? 1);
    const accel = f.grounded ? GROUND_ACCEL : airAccel;

    if (input.moveX !== 0) {
      f.vel.x = moveToward(f.vel.x, targetVx, accel * dt);
      f.facing = input.moveX > 0 ? 1 : -1;
    } else {
      // No input: bleed off speed via friction / drag.
      const decel = (f.grounded ? GROUND_FRICTION : AIR_DRAG) * dt;
      f.vel.x = moveToward(f.vel.x, 0, decel);
    }
  } else if (f.grounded && f.attack) {
    // Attacks root the fighter somewhat: heavy friction.
    f.vel.x = moveToward(f.vel.x, 0, GROUND_FRICTION * 1.5 * dt);
  }

  // --- Jumping ------------------------------------------------------------
  if (canAct && input.jump) {
    const maxJumps = debug.unlimitedJumps ? 999 : 1 + f.config.extraJumps;
    if (f.grounded) {
      f.vel.y = stats.jumpHeight;
      f.grounded = false;
      f.jumpsUsed = 1;
      f.state = 'jump';
      f.stateTime = 0;
    } else if (f.jumpsUsed < maxJumps) {
      // Mid-air jumps get a slightly stronger, refreshed burst.
      f.vel.y = stats.jumpHeight * 1.02;
      f.jumpsUsed += 1;
      f.state = 'doubleJump';
      f.stateTime = 0;
    }
  }

  // --- Fast fall ----------------------------------------------------------
  if (!f.grounded && input.moveY < -0.5 && f.vel.y < 4) {
    f.vel.y -= GRAVITY * 0.6 * dt;
  }

  // --- Gravity ------------------------------------------------------------
  if (!f.grounded) {
    // Per-fighter gravity: floaties hang (better air game), heavies fast-fall.
    f.vel.y -= GRAVITY * (stats.gravityMul ?? 1) * debug.gravityScale * dt;
    if (f.vel.y < -MAX_FALL_SPEED) f.vel.y = -MAX_FALL_SPEED;
  }
}

/** Integrate position and resolve platform collisions. Returns grounded state. */
export function integratePosition(
  f: FighterRuntime,
  input: InputFrame,
  arena: ArenaConfig,
  dt: number,
): void {
  const prevY = f.pos.y;
  f.pos.x += f.vel.x * dt;
  f.pos.y += f.vel.y * dt;

  const wasGrounded = f.grounded;
  const impactSpeed = -f.vel.y; // downward speed this step (positive while falling)
  f.grounded = false;
  f.landSpeed = 0;

  const feetPrev = prevY - FIGHTER_HALF_HEIGHT;

  for (const p of arena.platforms) {
    const top = p.y + p.height / 2;
    const left = p.x - p.width / 2;
    const right = p.x + p.width / 2;

    // Only land on the top surface, and only while falling.
    if (f.vel.y > 0.01) continue;

    const feet = f.pos.y - FIGHTER_HALF_HEIGHT;
    const withinX = f.pos.x + FIGHTER_HALF_WIDTH > left && f.pos.x - FIGHTER_HALF_WIDTH < right;
    if (!withinX) continue;

    // Pass-through platforms are skipped if the player is holding down to drop.
    const dropping = p.passThrough && input.moveY < -0.5;
    if (dropping) continue;

    // Land only when the feet cross the surface from above this step.
    const crossed = feetPrev >= top - 0.05 && feet <= top;
    const solidLanding = !p.passThrough && feet <= top && feet > top - 0.6;

    if (crossed || solidLanding) {
      f.pos.y = top + FIGHTER_HALF_HEIGHT;
      f.vel.y = 0;
      f.grounded = true;
      if (!wasGrounded) f.landSpeed = Math.max(0, impactSpeed);
      break;
    }
  }

  if (f.grounded && !wasGrounded && f.state !== 'land') {
    f.jumpsUsed = 0;
    if (f.state === 'jump' || f.state === 'doubleJump' || f.state === 'fall') {
      f.state = 'land';
      f.stateTime = 0;
    }
  }
}

/** Nearest platform top surface below/at the fighter (used by AI recovery). */
export function nearestGround(arena: ArenaConfig, x: number): Platform | null {
  let best: Platform | null = null;
  for (const p of arena.platforms) {
    const left = p.x - p.width / 2;
    const right = p.x + p.width / 2;
    if (x >= left && x <= right) {
      if (!best || p.y > best.y) best = p;
    }
  }
  return best;
}

/**
 * The specific platform a grounded fighter's feet are actually resting on —
 * matched by height, not just "the tallest platform under this x". Stages
 * like Sky Temple stack a floating platform directly above the main one, so
 * `nearestGround` (topmost-by-x) can return the wrong platform entirely for
 * a fighter standing on the lower one; this is what edge-aware ultimate
 * movement (e.g. a ground-locked dash) needs instead.
 */
export function standingPlatform(arena: ArenaConfig, feetY: number, x: number): Platform | null {
  for (const p of arena.platforms) {
    const top = p.y + p.height / 2;
    if (Math.abs(feetY - top) > 0.05) continue;
    const left = p.x - p.width / 2;
    const right = p.x + p.width / 2;
    if (x >= left && x <= right) return p;
  }
  return null;
}

/** Returns true if the fighter has crossed a blast zone this step. */
export function crossedBlastZone(f: FighterRuntime, arena: ArenaConfig): boolean {
  const b = arena.blastZone;
  return f.pos.x < b.left || f.pos.x > b.right || f.pos.y > b.top || f.pos.y < b.bottom;
}
