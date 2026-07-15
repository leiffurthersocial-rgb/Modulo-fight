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
export type GameMode = 'practice' | '1v1' | 'survive';

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
  /**
   * Air-manoeuvrability multiplier (1 = default). Acrobats and speedsters steer
   * harder in the air; heavies drift like bricks. Gives each fighter a distinct
   * aerial feel beyond raw stats.
   */
  airControl?: number;
  /**
   * Gravity multiplier (1 = default). <1 = floaty (hangs in the air, better air
   * game, but juggled longer); >1 = heavy fast-faller (grounded, poor recovery).
   */
  gravityMul?: number;
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
  /**
   * If set, the move is a multi-hit: the same target can be struck again every
   * `hitInterval` seconds while the hitbox is active (a flurry that racks up
   * damage). Omit for a normal one-hit-per-swing attack.
   */
  hitInterval?: number;
  /**
   * Syphon: fraction of the damage dealt that is drained back, reducing the
   * attacker's own damage % on hit. Deliberately small-scale — a sustain tool,
   * not a reset button (healing is also capped per hit in the combat system).
   */
  syphon?: number;

  /* --- Signature ultimate mechanics (each used by exactly one fighter) --- */

  /** The attacker surges forward at high speed while the hitbox is active. */
  surge?: boolean;
  /** The attacker rises upward during the move (aerial carry ultimates). */
  riseSelf?: boolean;
  /** Hits every *grounded* opponent anywhere on the stage (seismic wave). */
  quake?: boolean;
  /**
   * The hit deals its full damage but no knockback at all — a "curse" that
   * loads the victim's percentage without the mercy of a launch.
   */
  noKnockback?: boolean;
  /**
   * The hit ignores *dodge* invulnerability — you cannot roll through it, only
   * space around it (spawn invulnerability is still respected so respawns are
   * safe). Makes an ultimate "impossible to dodge".
   */
  piercesInvuln?: boolean;
  /** Fires a volley of projectiles instead of relying on the melee hitbox. */
  projectiles?: {
    /** Number of bolts fired over the active window. */
    count: number;
    /** Horizontal speed of each bolt (units/sec). */
    speed: number;
    /** Seconds between consecutive bolts. */
    interval: number;
  };
  /**
   * A pure self-buff ultimate (no hitbox): on cast the attacker enters an
   * "overdrive" state for `duration` seconds during which their attacks come
   * out `attackSpeed`× faster (cooldowns and attack frames advance faster) and
   * they move `moveSpeed`× faster. Set the move's `active` to 0 so it never
   * spawns a damaging hitbox — the payoff is entirely the buff.
   */
  hasteSelf?: {
    /** Seconds the haste lasts. */
    duration: number;
    /** Attack-timeline speed multiplier while hasted (2 = double hitspeed). */
    attackSpeed: number;
    /** Ground/air movement-speed multiplier while hasted. */
    moveSpeed: number;
  };
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
  hairStyle:
    | 'short'
    | 'medium'
    | 'styled'
    | 'goatee'
    | 'spiky'
    | 'long'
    | 'mohawk'
    | 'buzz'
    | 'bald'
    | 'ponytail';
  eyes: string;
  shirt: string;
  /** Trouser colour (falls back to a neutral dark if omitted). */
  pants?: string;
  /** Shoe colour (falls back to near-black if omitted). */
  shoes?: string;
  /** Body build — scales the silhouette's bulk (defaults to 'normal'). */
  build?: 'lean' | 'normal' | 'heavy';
  /** Optional headband colour (worn across the forehead). */
  headband?: string;
  /** Optional scarf colour (worn around the neck). */
  scarf?: string;
  /** Optional boxing-style glove colour (replaces bare fists). */
  gloves?: string;
  /** Optional cape colour (hangs from the shoulders behind the torso). */
  cape?: string;
  /** Optional shoulder-pad colour (armoured pauldrons). */
  shoulderPads?: string;
  /** Optional backpack colour (tech pack with a glowing accent light). */
  backpack?: string;
  /** Optional knee-pad colour. */
  kneePads?: string;
  /** Optional glowing chest pendant (accent-coloured, emissive). */
  pendant?: boolean;
  /** Optional royal crown worn on the head (gold band, prongs and jewels). */
  crown?: boolean;
  /** Optional goggles colour — a band with tinted lenses worn on the forehead. */
  goggles?: string;
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
  /**
   * How fast this fighter fills their ultimate meter (multiplier, default 1).
   * The core balance lever: devastating ultimates charge slowly (<1) while
   * modest ones charge quickly (>1), so a fighter with a game-ending ult pays
   * for it in patience, and a fighter with a weaker ult gets to use it often.
   * Scales both the passive charge tick and charge gained by dealing damage.
   */
  ultChargeRate?: number;
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
