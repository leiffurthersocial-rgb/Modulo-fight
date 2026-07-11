/**
 * Simulation — the authoritative match runtime.
 *
 * Owns every fighter's runtime state and advances the whole match with a
 * fixed timestep (accumulator pattern) so behaviour is identical regardless of
 * display frame-rate. React never drives gameplay; it only reads snapshots.
 */
import type { ArenaConfig, Difficulty, GameMode, Vec2 } from '@/core/types';
import {
  DASH_DURATION,
  DASH_SPEED,
  DODGE_DURATION,
  DODGE_INVULN,
  DODGE_SPEED,
  FIXED_DT,
  MAX_STEPS_PER_FRAME,
  RESPAWN_Y,
  SHIELD_DRAIN,
  SHIELD_MAX,
  SHIELD_REGEN,
  SPAWN_INVULN,
} from '@/core/constants';
import { clamp } from '@/core/math';
import type { InputFrame } from '@/systems/input/InputState';
import { emptyInput } from '@/systems/input/InputState';
import { AIController } from '@/systems/ai/AIController';
import {
  crossedBlastZone,
  integrateMovement,
  integratePosition,
} from '@/systems/physics/PhysicsSystem';
import {
  resolveAttackHits,
  tryStartAttack,
  updateAttack,
  updateCombo,
} from '@/systems/combat/CombatSystem';
import { EventBus } from './events';
import {
  createFighterRuntime,
  isBusy,
  type FighterRuntime,
} from './FighterRuntime';

export interface FighterSetup {
  configId: string;
  isPlayer: boolean;
  difficulty: Difficulty;
}

export interface MatchConfig {
  mode: GameMode;
  arena: ArenaConfig;
  fighters: FighterSetup[];
  stocks: number;
  timeLimit: number;
}

export type MatchStatus = 'running' | 'paused' | 'finished';

export interface MatchResult {
  winnerIndex: number | null;
  placements: number[]; // fighter indices best → worst
}

/** Provider of the local player's input each step. */
export type PlayerInputSource = () => InputFrame;

export class Simulation {
  readonly fighters: FighterRuntime[] = [];
  readonly events = new EventBus();
  readonly config: MatchConfig;

  status: MatchStatus = 'running';
  timeRemaining: number;
  result: MatchResult | null = null;

  private ai = new AIController();
  private accumulator = 0;
  private playerInput: PlayerInputSource;
  private eliminationOrder: number[] = [];

  constructor(config: MatchConfig, getFighterConfig: (id: string) => FighterRuntime['config'], playerInput: PlayerInputSource) {
    this.config = config;
    this.timeRemaining = config.timeLimit;
    this.playerInput = playerInput;

    config.fighters.forEach((setup, i) => {
      const spawn = config.arena.spawns[i % config.arena.spawns.length];
      this.fighters.push(
        createFighterRuntime(
          getFighterConfig(setup.configId),
          i,
          spawn,
          setup.isPlayer,
          setup.difficulty,
          config.stocks,
        ),
      );
    });
  }

  pause(): void {
    if (this.status === 'running') this.status = 'paused';
  }

  resume(): void {
    if (this.status === 'paused') this.status = 'running';
  }

  /** Advance the simulation by real elapsed seconds using fixed steps. */
  advance(realDt: number): void {
    if (this.status !== 'running') return;
    // Clamp to avoid huge catch-up after a tab stall.
    this.accumulator += Math.min(realDt, 0.25);
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps += 1;
    }
  }

  private step(dt: number): void {
    // --- Match timer --------------------------------------------------------
    if (this.config.timeLimit > 0) {
      this.timeRemaining = Math.max(0, this.timeRemaining - dt);
      if (this.timeRemaining <= 0) return this.finish();
    }

    // 1. Gather inputs.
    const inputs: InputFrame[] = this.fighters.map((f) => {
      if (f.eliminated || f.respawnTimer > 0) return emptyInput();
      if (f.isPlayer) return this.playerInput();
      return this.ai.update(f, this.fighters, this.config.arena, dt);
    });

    // 2. Update each fighter's timers and movement.
    this.fighters.forEach((f, i) => this.updateFighter(f, inputs[i], dt));

    // 3. Resolve combat after everyone has moved (order-independent hits).
    for (const f of this.fighters) {
      resolveAttackHits(f, this.fighters, this.events);
    }

    // 4. Blast zones, stocks and respawns.
    for (const f of this.fighters) this.handleBoundaries(f, dt);

    // 5. Win condition.
    this.checkMatchEnd();
  }

  private updateFighter(f: FighterRuntime, input: InputFrame, dt: number): void {
    if (f.eliminated) return;

    // --- Countdown timers ---------------------------------------------------
    f.stateTime += dt;
    if (f.hitstun > 0) f.hitstun = Math.max(0, f.hitstun - dt);
    if (f.invuln > 0) f.invuln = Math.max(0, f.invuln - dt);
    if (f.hitFlash > 0) f.hitFlash = Math.max(0, f.hitFlash - dt);
    if (f.actionTimer > 0) f.actionTimer = Math.max(0, f.actionTimer - dt);
    if (f.wasHitRecently > 0) f.wasHitRecently = Math.max(0, f.wasHitRecently - dt);
    for (const k of Object.keys(f.cooldowns)) {
      if (f.cooldowns[k] > 0) f.cooldowns[k] = Math.max(0, f.cooldowns[k] - dt);
    }
    updateCombo(f, dt);
    updateAttack(f, dt);

    // Slow passive ultimate charge so ults are always eventually reachable.
    f.ultCharge = clamp(f.ultCharge + dt * 0.018, 0, 1);

    if (f.respawnTimer > 0) {
      f.respawnTimer = Math.max(0, f.respawnTimer - dt);
      return;
    }

    const inHitstun = f.hitstun > 0;
    const canAct = !inHitstun && !isBusy(f);

    // --- Discrete actions ---------------------------------------------------
    if (canAct) {
      this.handleShield(f, input, dt);
      if (!f.shielding) {
        if (input.dodge) this.startDodge(f, input);
        else if (input.dash) this.startDash(f);
        else if (input.ultimate) {
          if (tryStartAttack(f, 'ultimate'))
            this.events.emit({ type: 'ultimate', pos: { ...f.pos }, fighterId: f.config.id });
        } else if (input.special) {
          if (tryStartAttack(f, 'special')) this.events.emit({ type: 'special', pos: { ...f.pos }, fighterId: f.config.id });
        } else if (input.heavy) tryStartAttack(f, 'heavy');
        else if (input.light) tryStartAttack(f, 'light');
      }
    } else if (f.shielding) {
      // Drop shield if we got hit / became busy.
      f.shielding = false;
    }

    // --- Movement integration ----------------------------------------------
    const moveInput = this.effectiveMoveInput(f, input);
    integrateMovement(f, moveInput, dt, canAct && f.actionTimer <= 0);
    integratePosition(f, moveInput, this.config.arena, dt);

    // --- Cosmetic state resolution -----------------------------------------
    this.resolveState(f, input);
  }

  /** Dash/dodge override the raw movement while their burst timer runs. */
  private effectiveMoveInput(f: FighterRuntime, input: InputFrame): InputFrame {
    if (f.state === 'dash' && f.actionTimer > 0) {
      const boosted = { ...input };
      f.vel.x = f.facing * DASH_SPEED;
      boosted.moveX = 0;
      return boosted;
    }
    if (f.state === 'dodge' && f.actionTimer > 0) {
      const boosted = { ...input };
      boosted.moveX = 0;
      return boosted;
    }
    return input;
  }

  private handleShield(f: FighterRuntime, input: InputFrame, dt: number): void {
    if (input.shield && f.grounded && f.shield > 0.05) {
      f.shielding = true;
      f.shield = clamp(f.shield - SHIELD_DRAIN * dt, 0, SHIELD_MAX);
      f.state = 'shield';
      f.vel.x = 0;
    } else {
      f.shielding = false;
      f.shield = clamp(f.shield + SHIELD_REGEN * dt, 0, SHIELD_MAX);
    }
  }

  private startDodge(f: FighterRuntime, input: InputFrame): void {
    f.state = 'dodge';
    f.stateTime = 0;
    f.actionTimer = DODGE_DURATION;
    f.invuln = Math.max(f.invuln, DODGE_INVULN);
    const dir = input.moveX !== 0 ? Math.sign(input.moveX) : -f.facing;
    f.vel.x = dir * DODGE_SPEED;
  }

  private startDash(f: FighterRuntime): void {
    f.state = 'dash';
    f.stateTime = 0;
    f.actionTimer = DASH_DURATION;
    f.vel.x = f.facing * DASH_SPEED;
  }

  /** Derive idle/walk/run/jump/fall for the animation system. */
  private resolveState(f: FighterRuntime, input: InputFrame): void {
    if (f.attack || f.hitstun > 0) return; // combat/hit states own themselves
    if (f.state === 'dodge' || f.state === 'dash') {
      if (f.actionTimer <= 0) f.state = f.grounded ? 'idle' : 'fall';
      return;
    }
    if (f.shielding) {
      f.state = 'shield';
      return;
    }
    if (!f.grounded) {
      if (f.vel.y < -0.5 && f.state !== 'jump' && f.state !== 'doubleJump') f.state = 'fall';
      else if (f.state !== 'jump' && f.state !== 'doubleJump' && f.state !== 'fall') f.state = 'fall';
      return;
    }
    if (f.state === 'land' && f.stateTime < 0.12) return; // brief landing pose
    const speed = Math.abs(f.vel.x);
    if (speed < 0.3) f.state = 'idle';
    else if (input.sprint || speed > f.config.stats.speed * 1.1) f.state = 'run';
    else f.state = 'walk';
  }

  private handleBoundaries(f: FighterRuntime, _dt: number): void {
    if (f.eliminated || f.respawnTimer > 0) return;
    if (!crossedBlastZone(f, this.config.arena)) return;

    // Ring-out: lose a stock.
    f.stocks -= 1;
    this.events.emit({ type: 'knockout', pos: { ...f.pos }, victimId: f.config.id });

    if (f.stocks <= 0) {
      f.eliminated = true;
      f.stocks = 0;
      if (!this.eliminationOrder.includes(f.index)) this.eliminationOrder.push(f.index);
      return;
    }

    // Respawn above stage centre with invulnerability.
    const centre = this.config.arena.platforms[0];
    const spawn: Vec2 = { x: centre.x, y: centre.y + RESPAWN_Y };
    f.pos = { ...spawn };
    f.vel = { x: 0, y: 0 };
    f.damage = 0;
    f.hitstun = 0;
    f.attack = null;
    f.comboCount = 0;
    f.invuln = SPAWN_INVULN;
    f.respawnTimer = 0.4;
    f.state = 'fall';
  }

  private checkMatchEnd(): void {
    const alive = this.fighters.filter((f) => !f.eliminated);
    if (alive.length <= 1 && this.fighters.length > 1) {
      this.finish();
    }
  }

  private finish(): void {
    if (this.status === 'finished') return;
    this.status = 'finished';

    // Placements: survivors ranked by stocks then inverse damage, then the
    // elimination order (last out = better place).
    const alive = this.fighters
      .filter((f) => !f.eliminated)
      .sort((a, b) => b.stocks - a.stocks || a.damage - b.damage)
      .map((f) => f.index);
    const eliminated = [...this.eliminationOrder].reverse();
    const placements = [...alive, ...eliminated.filter((i) => !alive.includes(i))];

    this.result = {
      winnerIndex: placements.length > 0 ? placements[0] : null,
      placements,
    };
  }
}
