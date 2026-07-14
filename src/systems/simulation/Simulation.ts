/**
 * Simulation — the authoritative match runtime.
 *
 * Owns every fighter's runtime state and advances the whole match with a
 * fixed timestep (accumulator pattern) so behaviour is identical regardless of
 * display frame-rate. React never drives gameplay; it only reads snapshots.
 */
import type { ArenaConfig, Difficulty, FighterConfig, GameMode, Vec2 } from '@/core/types';
import {
  DASH_DURATION,
  DASH_SPEED,
  DI_STRENGTH,
  DODGE_DURATION,
  DODGE_INVULN,
  DODGE_SPEED,
  FIGHTER_HALF_HEIGHT,
  FIGHTER_HALF_WIDTH,
  FIXED_DT,
  HITSTOP_BASE,
  HITSTOP_KO,
  HITSTOP_MAX,
  HITSTOP_PER_POWER,
  MAX_STEPS_PER_FRAME,
  RESPAWN_Y,
  SHIELD_DRAIN,
  SHIELD_MAX,
  SHIELD_REGEN,
  SPAWN_INVULN,
  SURVIVE_WAVE_DELAY,
} from '@/core/constants';
import { clamp } from '@/core/math';
import { debug, practice } from '@/core/debug';
import type { InputFrame } from '@/systems/input/InputState';
import { emptyInput } from '@/systems/input/InputState';
import { AIController } from '@/systems/ai/AIController';
import {
  crossedBlastZone,
  integrateMovement,
  integratePosition,
  standingPlatform,
} from '@/systems/physics/PhysicsSystem';
import {
  applyHit,
  attackHitboxActive,
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
  /** Optional per-fighter stock override (defaults to the match's `stocks`). */
  stocks?: number;
}

/** Describes the next opponent to spawn in Survive mode. */
export interface SurviveOpponent {
  configId: string;
  difficulty: Difficulty;
}

export interface MatchConfig {
  mode: GameMode;
  arena: ArenaConfig;
  fighters: FighterSetup[];
  stocks: number;
  timeLimit: number;
  /** Survive mode: supplies the opponent for a given wave (1-based). */
  nextOpponent?: (wave: number, prevId: string | null) => SurviveOpponent;
}

export type MatchStatus = 'running' | 'paused' | 'finished';

/** A live projectile (Erim's Laser Barrage). Plain object, pooled by index. */
export interface Projectile {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Index of the fighter who fired it (credits hits/KOs). */
  ownerIndex: number;
  /** Remaining lifetime in seconds. */
  life: number;
}

const MAX_PROJECTILES = 12;
const PROJECTILE_RADIUS = 0.45;
const PROJECTILE_LIFE = 1.6;

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

  /** Survive mode: opponents defeated so far (the score) and current wave. */
  score = 0;
  wave = 1;

  /** Remaining impact-freeze time; while > 0 the whole match is paused. */
  hitStop = 0;

  /** Fixed pool of projectiles (Laser Barrage bolts). Renderer reads directly. */
  readonly projectiles: Projectile[] = Array.from({ length: MAX_PROJECTILES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    ownerIndex: 0,
    life: 0,
  }));
  private projectileCursor = 0;

  private ai = new AIController();
  private accumulator = 0;
  private playerInput: PlayerInputSource;
  private eliminationOrder: number[] = [];
  /** Monotonic in-match time, used to script practice-dummy behaviour. */
  private elapsed = 0;
  private getFighterConfig: (id: string) => FighterConfig;
  /** Survive mode: countdown between a defeat and the next opponent spawning. */
  private waveDelay = 0;

  constructor(config: MatchConfig, getFighterConfig: (id: string) => FighterConfig, playerInput: PlayerInputSource) {
    this.config = config;
    this.timeRemaining = config.timeLimit;
    this.playerInput = playerInput;
    this.getFighterConfig = getFighterConfig;

    config.fighters.forEach((setup, i) => {
      const spawn = config.arena.spawns[i % config.arena.spawns.length];
      this.fighters.push(
        createFighterRuntime(
          getFighterConfig(setup.configId),
          i,
          spawn,
          setup.isPlayer,
          setup.difficulty,
          setup.stocks ?? config.stocks,
        ),
      );
    });

    // Impact freeze-frames: heavier hits (and KOs) pause the match briefly so
    // strikes land with weight. Driven off the same events the renderer uses.
    this.events.subscribe((e) => {
      if (e.type === 'hit') {
        const s = Math.min(HITSTOP_BASE + e.power * HITSTOP_PER_POWER, HITSTOP_MAX);
        if (s > this.hitStop) this.hitStop = s;
      } else if (e.type === 'knockout' || e.type === 'ultimate') {
        if (HITSTOP_KO > this.hitStop) this.hitStop = HITSTOP_KO;
      }
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
    const scaled = realDt * debug.timeScale;
    // Impact freeze: consume real time into the hitstop timer and skip stepping
    // while it lasts. The renderer keeps drawing (particles, shake), so the
    // frozen instant reads as a punchy "hit pause".
    if (this.hitStop > 0) {
      this.hitStop -= scaled;
      if (this.hitStop > 0) return;
    }
    // Clamp to avoid huge catch-up after a tab stall; debug time-scale lets us
    // slow-mo or fast-forward the whole match.
    this.accumulator += Math.min(scaled, 0.25);
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps += 1;
    }
  }

  private step(dt: number): void {
    this.elapsed += dt;

    // --- Match timer --------------------------------------------------------
    if (this.config.timeLimit > 0) {
      this.timeRemaining = Math.max(0, this.timeRemaining - dt);
      if (this.timeRemaining <= 0) return this.finish();
    }

    const isPractice = this.config.mode === 'practice';

    // 1. Gather inputs (player / practice dummy / AI bot).
    const inputs: InputFrame[] = this.fighters.map((f) => {
      if (f.eliminated || f.respawnTimer > 0) return emptyInput();
      if (f.isPlayer) return this.playerInput();
      if (isPractice) return this.trainingInput(f, dt);
      if (debug.freezeBots) return emptyInput();
      return this.ai.update(f, this.fighters, this.config.arena, dt);
    });

    // 2. Update each fighter's timers and movement.
    this.fighters.forEach((f, i) => this.updateFighter(f, inputs[i], dt));

    // 3. Resolve combat after everyone has moved (order-independent hits).
    for (const f of this.fighters) {
      resolveAttackHits(f, this.fighters, this.events, dt);
    }

    // 3b. Projectiles: fire pending bolts, then fly + collide.
    this.updateProjectiles(dt);

    // 4. Blast zones, stocks and respawns.
    for (const f of this.fighters) this.handleBoundaries(f, dt);

    // 5. Survive mode: spawn the next opponent after the between-wave beat.
    if (this.config.mode === 'survive' && this.waveDelay > 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) this.spawnNextOpponent();
    }

    // 6. Win condition.
    this.checkMatchEnd();
  }

  private updateFighter(f: FighterRuntime, input: InputFrame, dt: number): void {
    if (f.eliminated) return;

    // Practice: mark non-player dummies immovable when requested.
    f.immovable = this.config.mode === 'practice' && practice.immovable && !f.isPlayer;

    // Debug overrides for the local player.
    if (f.isPlayer) {
      if (debug.infiniteUlt) f.ultCharge = 1;
      if (debug.playerInvincible) f.invuln = Math.max(f.invuln, 0.2);
      if (debug.noCooldowns) for (const k of Object.keys(f.cooldowns)) f.cooldowns[k] = 0;
    }

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
        } else if (input.heavy) {
          if (tryStartAttack(f, 'heavy')) this.events.emit({ type: 'attack', pos: { ...f.pos }, kind: 'heavy' });
        } else if (input.light) {
          if (tryStartAttack(f, 'light')) this.events.emit({ type: 'attack', pos: { ...f.pos }, kind: 'light' });
        }
      }
    } else if (f.shielding) {
      // Drop shield if we got hit / became busy.
      f.shielding = false;
    }

    // --- Signature ultimate movement -----------------------------------------
    // Surge (Golden Rush): the attacker barrels forward while the hitbox is
    // live — but only across solid ground. The velocity is capped every tick
    // to whatever distance remains to the platform edge (rather than just
    // gating on `grounded`), so a fast surge can't overshoot the edge in a
    // single step and go airborne before the edge check catches it; he skids
    // to a stop right at the ledge instead of launching into the blast zone.
    // An already-airborne surge (e.g. triggered mid-combo) isn't edge-checked
    // since there's no ledge under him to fall off of. Rise (Sky Storm): the
    // attacker spirals upward, carrying foes.
    if (f.attack && attackHitboxActive(f.attack)) {
      if (f.attack.data.surge) {
        const speed = 15;
        if (f.grounded) {
          const ground = standingPlatform(this.config.arena, f.pos.y - FIGHTER_HALF_HEIGHT, f.pos.x);
          if (ground) {
            // Small buffer beyond the fighter's half-width so he lands
            // comfortably grounded rather than exactly on the collision
            // boundary (which can round to "just off the edge").
            const margin = FIGHTER_HALF_WIDTH + 0.15;
            const rightEdge = ground.x + ground.width / 2 - margin;
            const leftEdge = ground.x - ground.width / 2 + margin;
            if (f.facing === 1) {
              const dist = Math.max(0, rightEdge - f.pos.x);
              f.vel.x = Math.min(speed, dist / dt);
            } else {
              const dist = Math.max(0, f.pos.x - leftEdge);
              f.vel.x = -Math.min(speed, dist / dt);
            }
          } else {
            f.vel.x = 0; // no ground beneath him at all — don't surge further
          }
        } else {
          f.vel.x = f.facing * speed;
        }
      }
      if (f.attack.data.riseSelf) {
        f.vel.y = Math.max(f.vel.y, 9);
        f.grounded = false;
      }
    }

    // --- Directional influence ---------------------------------------------
    // Airborne hitstun victims may nudge their launch trajectory by holding a
    // direction — a small window of agency that rewards good survival DI.
    if (inHitstun && !f.grounded && input.moveX !== 0) {
      f.vel.x += input.moveX * DI_STRENGTH * dt;
    }

    // --- Movement integration ----------------------------------------------
    const moveInput = this.effectiveMoveInput(f, input);
    integrateMovement(f, moveInput, dt, canAct && f.actionTimer <= 0);
    integratePosition(f, moveInput, this.config.arena, dt);

    // Landing puff — only for meaningful drops, so walking off ledges is quiet.
    if (f.landSpeed > 7) {
      this.events.emit({ type: 'land', pos: { x: f.pos.x, y: f.pos.y - 0.85 }, power: f.landSpeed });
    }

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
      const drainImmune = debug.infiniteShield && f.isPlayer;
      if (!drainImmune) f.shield = clamp(f.shield - SHIELD_DRAIN * dt, 0, SHIELD_MAX);
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

    // Ring-out: lose a stock. Credit the KO to whoever landed the last hit.
    f.stocks -= 1;
    this.events.emit({ type: 'knockout', pos: { ...f.pos }, victimId: f.config.id });
    if (f.lastHitBy) {
      const koer = this.fighters.find((x) => x.config.id === f.lastHitBy);
      if (koer) koer.koCount += 1;
      f.lastHitBy = null;
    }

    if (f.stocks <= 0) {
      f.eliminated = true;
      f.stocks = 0;
      // Survive mode: defeating the opponent advances a wave rather than ending
      // the match. The player being eliminated ends the run (handled below).
      if (this.config.mode === 'survive' && !f.isPlayer) {
        this.score += 1;
        this.waveDelay = SURVIVE_WAVE_DELAY;
        return;
      }
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

  /** Fire pending Laser Barrage bolts, then advance and collide all of them. */
  private updateProjectiles(dt: number): void {
    // Fire: any fighter mid-ultimate with a projectile config emits bolts on
    // a fixed cadence once startup completes.
    for (const f of this.fighters) {
      const atk = f.attack;
      const cfg = atk?.data.projectiles;
      if (!atk || !cfg) continue;
      while (
        atk.fired < cfg.count &&
        atk.elapsed >= atk.data.startup + atk.fired * cfg.interval
      ) {
        const p = this.projectiles[this.projectileCursor];
        this.projectileCursor = (this.projectileCursor + 1) % MAX_PROJECTILES;
        p.active = true;
        p.x = f.pos.x + f.facing * 0.9;
        // Slight vertical fan so the volley sweeps a band, not a single line.
        p.y = f.pos.y + 0.35 + (atk.fired % 3) * 0.35;
        p.vx = f.facing * cfg.speed;
        p.vy = 0;
        p.ownerIndex = f.index;
        p.life = PROJECTILE_LIFE;
        atk.fired += 1;
      }
    }

    // Fly + collide.
    const b = this.config.arena.blastZone;
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.x < b.left || p.x > b.right) {
        p.active = false;
        continue;
      }
      const owner = this.fighters[p.ownerIndex];
      if (!owner) {
        p.active = false;
        continue;
      }
      for (const victim of this.fighters) {
        if (victim === owner || victim.eliminated || victim.respawnTimer > 0) continue;
        if (victim.invuln > 0) continue;
        const dx = victim.pos.x - p.x;
        const dy = victim.pos.y - p.y;
        if (dx * dx + dy * dy > (PROJECTILE_RADIUS + 0.6) ** 2) continue;
        applyHit(owner, victim, owner.config.attacks.ultimate, this.events);
        p.active = false;
        break;
      }
    }
  }

  /** Produce input for a practice-mode training dummy. */
  private trainingInput(f: FighterRuntime, dt: number): InputFrame {
    if (debug.freezeBots) return emptyInput();
    const inp = emptyInput();
    switch (practice.behavior) {
      case 'ai':
        f.difficulty = practice.difficulty;
        return this.ai.update(f, this.fighters, this.config.arena, dt);
      case 'walk':
        inp.moveX = Math.sin(this.elapsed * 1.1);
        return inp;
      case 'jump':
        // Fire a jump once per second by detecting the integer-second boundary.
        inp.jump = Math.floor(this.elapsed) !== Math.floor(this.elapsed - dt);
        return inp;
      case 'shield':
        inp.shield = true;
        return inp;
      case 'dodge':
        inp.dodge = Math.floor(this.elapsed * 1.5) !== Math.floor((this.elapsed - dt) * 1.5);
        return inp;
      case 'stand':
      default:
        return inp;
    }
  }

  /* --------------------------- Debug actions ---------------------------- *
   * Invoked by the debug menu. They mutate live runtime state directly.    */

  /** The local player's runtime, if any. */
  get player(): FighterRuntime | undefined {
    return this.fighters.find((f) => f.isPlayer);
  }

  /** Reset every fighter to spawn, clearing damage and momentum. */
  resetPositions(): void {
    this.fighters.forEach((f, i) => {
      const spawn = this.config.arena.spawns[i % this.config.arena.spawns.length];
      f.pos = { x: spawn.x, y: spawn.y };
      f.vel = { x: 0, y: 0 };
      f.damage = 0;
      f.hitstun = 0;
      f.attack = null;
      f.comboCount = 0;
      f.eliminated = false;
      f.respawnTimer = 0;
      f.invuln = SPAWN_INVULN;
      f.state = 'fall';
    });
    if (this.status === 'finished') this.status = 'running';
  }

  /** Set a fighter's damage percentage (defaults to the player). */
  setDamage(value: number, target = this.player): void {
    if (target) target.damage = clamp(value, 0, 999);
  }

  /** Clear damage on all fighters. */
  healAll(): void {
    for (const f of this.fighters) f.damage = 0;
  }

  /** Fill the player's ultimate meter. */
  chargeUlt(): void {
    if (this.player) this.player.ultCharge = 1;
  }

  /** Launch the player for knockback/DI testing. */
  launchPlayer(dir: number): void {
    const p = this.player;
    if (!p) return;
    p.vel.x = dir * 22;
    p.vel.y = 16;
    p.grounded = false;
    p.state = 'knockback';
  }

  /** Survive mode: instantly clear the current opponent (debug/experiment). */
  skipWave(): void {
    if (this.config.mode !== 'survive') return;
    const opp = this.fighters.find((f) => !f.isPlayer && !f.eliminated);
    if (!opp) return;
    opp.eliminated = true;
    opp.stocks = 0;
    this.score += 1;
    this.waveDelay = SURVIVE_WAVE_DELAY;
  }

  /** Survive mode: replace the defeated opponent with the next, harder one. */
  private spawnNextOpponent(): void {
    if (!this.config.nextOpponent) return;
    this.wave = this.score + 1;
    const prevId = this.fighters[1]?.config.id ?? null;
    const next = this.config.nextOpponent(this.wave, prevId);
    const spawn = this.config.arena.spawns[1 % this.config.arena.spawns.length];
    this.fighters[1] = createFighterRuntime(
      this.getFighterConfig(next.configId),
      1,
      spawn,
      false,
      next.difficulty,
      1,
    );
    // Tell the render layer to swap in the new opponent's model.
    this.events.emit({ type: 'wave', wave: this.wave, score: this.score });
  }

  private checkMatchEnd(): void {
    // Practice never "ends" — it's a sandbox.
    if (this.config.mode === 'practice') return;
    // Survive ends only when the player is eliminated.
    if (this.config.mode === 'survive') {
      const player = this.fighters.find((x) => x.isPlayer);
      if (player && player.eliminated) this.finish();
      return;
    }
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
