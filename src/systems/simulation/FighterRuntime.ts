/**
 * FighterRuntime — the mutable, per-match state of a single fighter.
 *
 * This is deliberately a plain object (not React state). The simulation mutates
 * it every fixed step; React components read snapshots via refs/selectors. That
 * separation is what keeps us at 60 FPS — combat never triggers re-renders.
 */
import type {
  AttackData,
  Difficulty,
  Facing,
  FighterConfig,
  FighterState,
  Vec2,
} from '@/core/types';
import { DEFAULT_STOCKS, SHIELD_MAX, SPAWN_INVULN } from '@/core/constants';

/** An in-progress attack the fighter is currently performing. */
export interface ActiveAttack {
  data: AttackData;
  /** Elapsed time since the attack started. */
  elapsed: number;
  /**
   * Per-victim log of the `elapsed` time of the last connect. A single-hit
   * move only checks presence (hit once, never again); a multi-hit move
   * (`hitInterval` set) re-hits once enough time has passed.
   */
  hitLog: Map<string, number>;
  /** Projectile ultimates: how many bolts have been fired so far. */
  fired: number;
}

export interface FighterRuntime {
  readonly config: FighterConfig;
  readonly index: number;
  difficulty: Difficulty;
  isPlayer: boolean;

  pos: Vec2;
  vel: Vec2;
  facing: Facing;

  state: FighterState;
  stateTime: number;

  grounded: boolean;
  jumpsUsed: number;

  /** Accumulated damage percentage (0 = fresh). */
  damage: number;

  /** Remaining hitstun in seconds; while > 0 the fighter can't act. */
  hitstun: number;
  /** Remaining invulnerability (spawn / dodge). */
  invuln: number;

  attack: ActiveAttack | null;
  /** Per-attack cooldown timers keyed by attack name. */
  cooldowns: Record<string, number>;

  /** Combo tracking for Robin's passive and combo UI. */
  comboCount: number;
  comboTimer: number;

  shield: number;
  shielding: boolean;

  /** Timer counting down a dash/dodge burst. */
  actionTimer: number;

  stocks: number;
  eliminated: boolean;
  /** Frames to wait before respawn after a ring-out. */
  respawnTimer: number;

  /** Whether this fighter took a counter-hit recently (Erim's passive). */
  wasHitRecently: number;

  /** Cosmetic: last-hit flash timer for the renderer. */
  hitFlash: number;

  /** Downward speed at the moment of the most recent landing (0 otherwise). */
  landSpeed: number;

  /** Cosmetic: intensity 0..1 for ultimate glow. */
  ultCharge: number;

  /**
   * Seconds of "overdrive" haste remaining (Leif's Overdrive ultimate). While
   * > 0 the fighter's attack timeline and cooldowns advance faster and they
   * move faster — the multipliers are read from the ult's `hasteSelf` config.
   */
  haste: number;

  /** Practice/debug: immune to knockback and launch (combo practice). */
  immovable: boolean;

  /** Lifetime stats — never reset by respawn, used for post-match balance data. */
  totalDamageDealt: number;
  totalDamageTaken: number;
  koCount: number;
  /** Id of whoever landed the most recent hit (credited on a ring-out KO). */
  lastHitBy: string | null;
}

export function createFighterRuntime(
  config: FighterConfig,
  index: number,
  spawn: Vec2,
  isPlayer: boolean,
  difficulty: Difficulty,
  stocks: number = DEFAULT_STOCKS,
): FighterRuntime {
  return {
    config,
    index,
    difficulty,
    isPlayer,
    pos: { x: spawn.x, y: spawn.y },
    vel: { x: 0, y: 0 },
    facing: spawn.x <= 0 ? 1 : -1,
    state: 'idle',
    stateTime: 0,
    grounded: false,
    jumpsUsed: 0,
    damage: 0,
    hitstun: 0,
    invuln: SPAWN_INVULN,
    attack: null,
    cooldowns: {},
    comboCount: 0,
    comboTimer: 0,
    shield: SHIELD_MAX,
    shielding: false,
    actionTimer: 0,
    stocks,
    eliminated: false,
    respawnTimer: 0,
    wasHitRecently: 0,
    hitFlash: 0,
    landSpeed: 0,
    ultCharge: 0,
    haste: 0,
    immovable: false,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    koCount: 0,
    lastHitBy: null,
  };
}

/** True when the fighter is busy and cannot start a new action. */
export function isBusy(f: FighterRuntime): boolean {
  return (
    f.hitstun > 0 ||
    f.attack !== null ||
    f.state === 'dodge' ||
    f.state === 'dash' ||
    f.eliminated ||
    f.respawnTimer > 0
  );
}

/** Total damage-scaled hitbox reach including the fighter's reach passive. */
export function effectiveReach(f: FighterRuntime, attack: AttackData): number {
  const bonus = f.config.passive === 'reach' ? 0.5 : 0;
  return attack.reach + bonus;
}
