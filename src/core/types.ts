/**
 * Core shared type definitions for Modulo Fight.
 *
 * Gameplay is simulated on a 2D plane (X = horizontal, Y = vertical) while
 * being rendered in 3D — the classic platform-fighter model. Keeping the
 * simulation 2D makes movement, collision and knockback deterministic and
 * cheap, which is essential for a stable 60 FPS.
 */

/** A minimal 2D vector used across the simulation layer. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Which way a fighter faces along the X axis. */
export type Facing = 1 | -1;

/** High-level animation / behaviour state of a fighter. */
export type FighterState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'doubleJump'
  | 'fall'
  | 'land'
  | 'light'
  | 'heavy'
  | 'special'
  | 'ultimate'
  | 'dash'
  | 'dodge'
  | 'shield'
  | 'hit'
  | 'knockback'
  | 'victory'
  | 'defeat';

/** The four attack categories every fighter shares. */
export type AttackKind = 'light' | 'heavy' | 'special' | 'ultimate';

/** AI skill tiers. `human` marks a fighter driven by the local player. */
export type Difficulty = 'human' | 'easy' | 'normal' | 'hard' | 'insane';

/** Supported game modes. */
export type GameMode = 'practice' | '1v1' | 'ffa4' | 'ffa8';

/** Top-level app screens. */
export type Screen =
  | 'mainMenu'
  | 'characterSelect'
  | 'settings'
  | 'credits'
  | 'game'
  | 'results';

/**
 * Balancing stats for a fighter, expressed as multipliers/units. These feed
 * directly into the physics and combat systems.
 */
export interface FighterStats {
  /** Ground movement speed (units/sec). */
  speed: number;
  /** Weight — resists knockback. Higher = harder to launch. */
  weight: number;
  /** Damage multiplier applied to all outgoing attacks. */
  strength: number;
  /** Initial jump velocity (units/sec). */
  jumpHeight: number;
  /** Additional knockback resistance (0–1, subtracted from taken knockback). */
  knockbackResist: number;
}

/** Frame data + hitbox description for a single attack. */
export interface AttackData {
  kind: AttackKind;
  name: string;
  /** Player-facing description of what the move does and how it feels. */
  description?: string;
  /** Seconds before the hitbox becomes active. */
  startup: number;
  /** Seconds the hitbox stays active. */
  active: number;
  /** Seconds of recovery after the hitbox ends. */
  recovery: number;
  /** Base damage dealt (before strength multiplier). */
  damage: number;
  /** Base knockback applied regardless of target damage. */
  baseKnockback: number;
  /** Additional knockback scaled by the target's accumulated damage. */
  knockbackScaling: number;
  /** Launch angle in radians (0 = right, PI/2 = up). */
  angle: number;
  /** Hitbox reach from the fighter's centre along facing. */
  reach: number;
  /** Vertical offset of the hitbox centre. */
  yOffset: number;
  /** Hitbox radius. */
  radius: number;
  /** Hitstun multiplier applied to the victim. */
  hitstun: number;
  /** Cooldown before the move can be used again (specials/ultimates). */
  cooldown: number;
}

/** Passive ability identifiers — resolved in the combat system. */
export type PassiveId =
  | 'comboGrowth'
  | 'runSpeed'
  | 'reach'
  | 'knockbackArmor'
  | 'counterForce'
  | 'tripleJump'
  | 'precision'
  | 'heavyStun';

/** Voxel character appearance description. */
export interface FighterAppearance {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'medium' | 'styled' | 'goatee';
  eyes: string;
  shirt: string;
  /** Trouser colour (falls back to a neutral dark if omitted). */
  pants?: string;
  /** Optional accessory flags. */
  glasses?: boolean;
  goatee?: boolean;
  /** Accent colour used for effects / UI. */
  accent: string;
}

/** Static, immutable description of a fighter (the "character sheet"). */
export interface FighterConfig {
  id: string;
  name: string;
  role: string;
  /** Emoji shown on the character-select card. */
  emoji: string;
  /** One-line playstyle summary for the select screen. */
  blurb: string;
  personality: string;
  stats: FighterStats;
  passive: PassiveId;
  passiveDescription: string;
  appearance: FighterAppearance;
  attacks: Record<AttackKind, AttackData>;
  /** Number of extra mid-air jumps (1 = double jump). */
  extraJumps: number;
}

/** A rectangular platform in the arena (AABB in the XY plane). */
export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  /** If true, fighters can jump up through it and drop through it. */
  passThrough: boolean;
}

/** Blast-zone boundaries. Crossing any of these eliminates a stock. */
export interface BlastZone {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Decoration set that drives an arena's themed props and ambient effects. */
export type ArenaDecoration =
  | 'temple'
  | 'volcano'
  | 'cyber'
  | 'forest'
  | 'castle'
  | 'snow'
  | 'space'
  | 'construction';

/** Presentation theme for an arena: colours, fog and decoration style. */
export interface ArenaTheme {
  /** Background / sky colour. */
  sky: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  /** Platform surface, side and underside colours. */
  platformTop: string;
  platformSide: string;
  platformUnder: string;
  /** Accent colour for edges / glows. */
  accent: string;
  decoration: ArenaDecoration;
}

/** Static description of an arena. */
export interface ArenaConfig {
  id: string;
  name: string;
  description: string;
  platforms: Platform[];
  blastZone: BlastZone;
  /** Spawn points used when placing fighters. */
  spawns: Vec2[];
  /** Whether this arena is implemented and selectable. */
  implemented: boolean;
  /** Visual theme. */
  theme: ArenaTheme;
}
