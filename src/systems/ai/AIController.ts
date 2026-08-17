/**
 * AIController — believable fighting-game bots.
 *
 * Each bot reasons about: which opponent to target, whether it is safe or must
 * recover to the stage, when to approach, attack, special, ultimate, or dodge.
 * Difficulty tunes reaction time, aggression and "tech skill" (recovery and
 * dodge quality) so Easy feels forgiving and Insane feels ruthless — without
 * ever cheating on inputs.
 */
import type { ArenaConfig, Difficulty } from '@/core/types';
import { clamp, dist } from '@/core/math';
import { emptyInput, type InputFrame } from '@/systems/input/InputState';
import { FIGHTER_HALF_HEIGHT } from '@/core/constants';
import { nearestGround, standingPlatform } from '@/systems/physics/PhysicsSystem';
import { effectiveReach, type FighterRuntime } from '@/systems/simulation/FighterRuntime';

interface Profile {
  /** Seconds between re-decisions (lower = sharper). */
  decisionInterval: number;
  /** Probability of choosing to attack when in range. */
  aggression: number;
  /** Probability of reacting to an incoming attack with a dodge. */
  reaction: number;
  /** Quality of recovery (higher = jumps/dashes back more reliably). */
  tech: number;
  /** Chance to use special/ultimate when available and in range. */
  abilityUse: number;
}

const PROFILES: Record<Exclude<Difficulty, 'human'>, Profile> = {
  easy: { decisionInterval: 0.5, aggression: 0.4, reaction: 0.1, tech: 0.4, abilityUse: 0.2 },
  normal: { decisionInterval: 0.32, aggression: 0.6, reaction: 0.3, tech: 0.7, abilityUse: 0.45 },
  hard: { decisionInterval: 0.2, aggression: 0.78, reaction: 0.55, tech: 0.9, abilityUse: 0.65 },
  insane: { decisionInterval: 0.1, aggression: 0.9, reaction: 0.8, tech: 1, abilityUse: 0.85 },
  // Nightmare: re-decides almost every frame, dodges nearly everything it sees
  // coming, and never wastes a cooldown. Still strictly input-driven — it reads
  // the same state a player can see and presses the same buttons.
  nightmare: {
    decisionInterval: 0.05, aggression: 0.97, reaction: 0.96, tech: 1, abilityUse: 0.97,
  },
};

/** Difficulty tiers that play a tighter spacing/punish game than the rest. */
const EXPERT: ReadonlySet<Difficulty> = new Set<Difficulty>(['nightmare']);

interface AIMemory {
  timer: number;
  /** Cached decision: horizontal intent this window. */
  moveDir: number;
  /** Chosen target id for this window. */
  targetId: string | null;
  /**
   * Seconds spent standing on a floating platform while the target is on a
   * different level. Drives the anti-camp descent below.
   */
  perchTime: number;
}

/**
 * How long a bot may stand on a floating platform away from its target before
 * it is forced to come down and fight.
 */
const MAX_PERCH_TIME = 1.6;

export class AIController {
  private memory = new Map<string, AIMemory>();

  reset(): void {
    this.memory.clear();
  }

  /** Produce the input frame for one AI fighter this step. */
  update(
    self: FighterRuntime,
    all: FighterRuntime[],
    arena: ArenaConfig,
    dt: number,
  ): InputFrame {
    const input = emptyInput();
    if (self.difficulty === 'human' || self.eliminated || self.respawnTimer > 0) return input;

    const profile = PROFILES[self.difficulty];
    let mem = this.memory.get(self.config.id);
    if (!mem) {
      mem = { timer: 0, moveDir: 0, targetId: null, perchTime: 0 };
      this.memory.set(self.config.id, mem);
    }

    const target = this.selectTarget(self, all, mem);

    // --- Off-stage recovery has top priority --------------------------------
    const ground = nearestGround(arena, self.pos.x);
    const stageCentreX = arena.platforms[0].x;
    const mainTop = arena.platforms[0].y + arena.platforms[0].height / 2;
    const offStage = !ground || self.pos.y < mainTop - 1.5;

    if (offStage && self.pos.y < mainTop + 2) {
      // Head back toward the stage and jump if below it.
      input.moveX = self.pos.x < stageCentreX ? 1 : -1;
      if (self.pos.y < mainTop && Math.random() < profile.tech) {
        input.jump = true;
      }
      // High-tech bots dodge/dash back if drifting too far.
      if (Math.abs(self.pos.x - stageCentreX) > arena.platforms[0].width && profile.tech > 0.8) {
        input.dash = true;
      }
      return input;
    }

    if (!target) return input;

    const dx = target.pos.x - self.pos.x;
    const dy = target.pos.y - self.pos.y;
    const horizontalDist = Math.abs(dx);
    const range = effectiveReach(self, self.config.attacks.light) + 0.4;

    // Face the target.
    const desiredFacing = dx >= 0 ? 1 : -1;
    const gap = dist(self.pos, target.pos);

    // --- React to the target's ULTIMATE (the biggest threat) ----------------
    // Each ultimate type demands a different escape, and the AI knows which:
    //   • quake (Leonidas) — only the airborne survive, so JUMP;
    //   • sky-hunt (Emir) — the ground is safer, so never jump; back off and
    //     dodge, since the sweep still hits grounded foes within reach;
    //   • pierces-invuln (Jovan) — a dodge won't work, so RUN out of range;
    //   • anything else — dodge-roll through it.
    // Reaction quality scales with difficulty, so easy bots still eat ults.
    const tAtk = target.attack;
    const targetUlting =
      tAtk?.data.kind === 'ultimate' && tAtk.elapsed < tAtk.data.startup + tAtk.data.active;
    if (targetUlting && gap < 7) {
      const data = tAtk!.data;
      if (data.quake) {
        if (self.grounded && Math.random() < profile.tech * dt * 30) input.jump = true;
        input.moveX = -desiredFacing;
        return input;
      }
      if (data.skyhunt) {
        // Inverse of the quake: the ground is the safe place, so resist the
        // usual urge to jump. Being airborne is unsurvivable at any distance,
        // and even grounded the sweep reaches — so dodge in both cases, and
        // put distance between us either way.
        const threatened = !self.grounded || gap < effectiveReach(target, data) + 1.5;
        if (threatened && Math.random() < profile.tech * dt * 30) input.dodge = true;
        input.moveX = -desiredFacing;
        return input;
      }
      if (data.piercesInvuln) {
        // Can't dodge it — put distance between us before the strike lands.
        input.moveX = -desiredFacing;
        input.sprint = true;
        return input;
      }
      if (Math.random() < profile.reaction * dt * 22) {
        input.dodge = true;
        input.moveX = -desiredFacing * 0.5;
        return input;
      }
    }

    // --- Reactive dodge vs normal attacks -----------------------------------
    const targetAttacking = tAtk && tAtk.elapsed < tAtk.data.startup + 0.05;
    if (targetAttacking && gap < range + 1 && Math.random() < profile.reaction * dt * 12) {
      input.dodge = true;
      input.moveX = -desiredFacing * 0.5;
      return input;
    }

    // --- Never camp on a floating platform ----------------------------------
    // Left alone, a bot parked on a top tile would stand there indefinitely:
    // with the target below it, horizontal distance is ~0, so the movement
    // decision holds still and nothing else ever pulls it down. Track how long
    // it has been perched away from its target and commit to a descent —
    // dropping straight through a pass-through tile, or walking off a solid one.
    const perch = standingPlatform(arena, self.pos.y - FIGHTER_HALF_HEIGHT, self.pos.x);
    const onFloatingPlatform = !!perch && perch !== arena.platforms[0];
    const sameLevel = Math.abs(dy) < 1.2;
    if (onFloatingPlatform && !sameLevel) mem.perchTime += dt;
    else mem.perchTime = 0;

    if (onFloatingPlatform && (dy < -1.2 || mem.perchTime > MAX_PERCH_TIME)) {
      if (perch!.passThrough) {
        input.moveY = -1; // drop through the tile
        input.moveX = desiredFacing * 0.4;
      } else {
        input.moveX = desiredFacing; // walk off the solid tile's edge
      }
      mem.perchTime = 0;
      return input;
    }

    // --- Climb to a target on a higher platform -----------------------------
    // Without this a bot stands on the main stage swinging at nothing while the
    // player pokes down from a side tile: the normal attack gate needs the
    // target within 1.6 units of its own height, which never happens from
    // below. Get underneath, jump onto their level, and swing once there.
    if (dy > 1.6) {
      let dir = horizontalDist > 0.7 ? desiredFacing : 0;
      // Side tiles overhang the main stage, so clamp against the widest solid
      // span rather than the main platform — far enough to climb, not to
      // wander into the blast zone.
      let safeLeft = Infinity;
      let safeRight = -Infinity;
      for (const p of arena.platforms) {
        safeLeft = Math.min(safeLeft, p.x - p.width / 2);
        safeRight = Math.max(safeRight, p.x + p.width / 2);
      }
      if (dir < 0 && self.pos.x < safeLeft + 0.6) dir = 0;
      if (dir > 0 && self.pos.x > safeRight - 0.6) dir = 0;
      input.moveX = dir;

      // Jump from the ground once roughly beneath them, and spend a mid-air
      // jump only at the top of the arc so the climb isn't wasted early.
      const wantJump = self.grounded ? horizontalDist < range * 2.4 : self.vel.y < 1;
      if (wantJump && Math.random() < profile.tech * dt * 16) input.jump = true;

      // Near their level now — actually threaten them.
      if (dy < 2.4 && horizontalDist < range && Math.random() < profile.aggression * dt * 12) {
        if (target.damage > 60 && Math.random() < 0.5) input.heavy = true;
        else input.light = true;
      }
      return input;
    }

    // --- Re-decide movement periodically -----------------------------------
    mem.timer -= dt;
    if (mem.timer <= 0) {
      mem.timer = profile.decisionInterval;
      if (horizontalDist > range) {
        mem.moveDir = desiredFacing;
      } else if (EXPERT.has(self.difficulty)) {
        // Expert spacing: hold at the tip of its own range, and only step back
        // to bait when the target actually commits to a move. Walking backwards
        // turns a fighter around (facing follows movement), so retreating on a
        // whim would just feed the opponent whiffed pokes.
        mem.moveDir = targetAttacking ? -desiredFacing * 0.5 : 0;
      } else {
        // Spacing: occasionally back off to bait, otherwise hold.
        mem.moveDir = Math.random() < 0.25 ? -desiredFacing * 0.6 : 0;
      }
    }
    input.moveX = mem.moveDir;

    // Don't stroll off the edge chasing.
    const edgeLeft = arena.platforms[0].x - arena.platforms[0].width / 2;
    const edgeRight = arena.platforms[0].x + arena.platforms[0].width / 2;
    if (self.pos.x < edgeLeft + 0.6 && input.moveX < 0) input.moveX = 0;
    if (self.pos.x > edgeRight - 0.6 && input.moveX > 0) input.moveX = 0;

    // --- Edgeguarding (expert tiers) ---------------------------------------
    // A recovering opponent is at their most vulnerable. Expert bots step out to
    // cover the ledge instead of politely waiting at centre stage.
    if (EXPERT.has(self.difficulty) && self.grounded) {
      const targetOffStage = !nearestGround(arena, target.pos.x) || target.pos.y < mainTop - 1;
      if (targetOffStage) {
        const ledge = target.pos.x < stageCentreX ? edgeLeft + 1 : edgeRight - 1;
        input.moveX = Math.abs(self.pos.x - ledge) > 0.5 ? Math.sign(ledge - self.pos.x) : 0;
        if (gap < range + 1.5 && Math.random() < profile.aggression * dt * 14) {
          input.heavy = true;
        }
        return input;
      }
    }

    // Sprint to close large gaps, and dash to burst-close medium ones (only
    // when already facing the target so the dash goes the right way; the
    // physics ledge-clamp keeps a grounded dash from sliding off the stage).
    if (horizontalDist > range * 2.5) input.sprint = true;
    if (
      horizontalDist > range * 3 &&
      self.grounded &&
      self.facing === desiredFacing &&
      Math.random() < profile.tech * dt * 4
    ) {
      input.dash = true;
    }

    // --- Jump to reach airborne / higher targets ---------------------------
    if (dy > 1.5 && horizontalDist < range * 2.5 && Math.random() < profile.tech * dt * 8) {
      input.jump = true;
    }

    // --- Stage-wide ultimates ignore melee range ----------------------------
    // Emir's Skyfall rakes the whole sky, so waiting to be nose-to-nose would
    // waste it: fire the instant the target leaves the ground, at any distance.
    if (
      self.ultCharge >= 1 &&
      self.config.attacks.ultimate.skyhunt &&
      !target.grounded &&
      Math.random() < profile.abilityUse * dt * 14
    ) {
      input.ultimate = true;
      return input;
    }

    // --- Attacks -----------------------------------------------------------
    const inRange = horizontalDist < range && Math.abs(dy) < 1.6;
    if (inRange && Math.random() < profile.aggression * dt * 10) {
      const special = self.config.attacks.special;
      const ult = self.config.attacks.ultimate;
      // Ultimate logic knows each ult's character: fire a curse (Jovan) or a
      // quake (Leonidas, while the target is grounded) whenever it will land;
      // otherwise save ultimates for kill percent.
      const wantUlt =
        self.ultCharge >= 1 &&
        (target.damage > 45 || ult.piercesInvuln || (!!ult.quake && target.grounded));
      if (wantUlt && Math.random() < profile.abilityUse) {
        input.ultimate = true;
      } else if ((self.cooldowns[special.name] ?? 0) <= 0 && Math.random() < profile.abilityUse) {
        input.special = true;
      } else if (target.damage > 60 && Math.random() < 0.6) {
        input.heavy = true; // go for the kill
      } else {
        input.light = true;
      }
    }

    return input;
  }

  /** Choose the closest living opponent, with light hysteresis to avoid jitter. */
  private selectTarget(
    self: FighterRuntime,
    all: FighterRuntime[],
    mem: AIMemory,
  ): FighterRuntime | null {
    const enemies = all.filter(
      (f) => f !== self && !f.eliminated && f.respawnTimer <= 0,
    );
    if (enemies.length === 0) return null;

    let best = enemies[0];
    let bestScore = Infinity;
    for (const e of enemies) {
      let score = dist(self.pos, e.pos);
      // Prefer keeping the current target unless another is clearly closer.
      if (e.config.id === mem.targetId) score *= 0.6;
      // Weakly prefer higher-damage (easier to KO) opponents.
      score -= clamp(e.damage, 0, 150) * 0.02;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    mem.targetId = best.config.id;
    return best;
  }
}
