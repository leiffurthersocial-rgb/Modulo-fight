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
import { nearestGround } from '@/systems/physics/PhysicsSystem';
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
};

interface AIMemory {
  timer: number;
  /** Cached decision: horizontal intent this window. */
  moveDir: number;
  /** Chosen target id for this window. */
  targetId: string | null;
}

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
      mem = { timer: 0, moveDir: 0, targetId: null };
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

    // --- Re-decide movement periodically -----------------------------------
    mem.timer -= dt;
    if (mem.timer <= 0) {
      mem.timer = profile.decisionInterval;
      if (horizontalDist > range) {
        mem.moveDir = desiredFacing;
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
