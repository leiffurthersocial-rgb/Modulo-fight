/**
 * Live tuning singletons for the debug menu and practice mode.
 *
 * These are plain mutable objects (not React state) so the fixed-step
 * simulation can read them every tick with zero overhead. The debug UI writes
 * to them through the Zustand `debugStore`, which mirrors them for reactivity.
 * Keeping them in `core` means both the simulation layer and the state layer
 * can depend on them without violating the architecture's dependency direction.
 */
import type { Difficulty } from './types';

/** Global debug/experiment flags. */
export interface DebugFlags {
  /** Simulation speed multiplier (slow-mo / fast-forward). */
  timeScale: number;
  /** Gravity multiplier. */
  gravityScale: number;
  /** Global knockback multiplier. */
  knockbackScale: number;
  /** Player takes no damage / knockback. */
  playerInvincible: boolean;
  /** Player's ultimate meter stays full. */
  infiniteUlt: boolean;
  /** All bots stop acting (frozen input). */
  freezeBots: boolean;
  /** Everyone can jump forever (recovery testing). */
  unlimitedJumps: boolean;
  /** Draw attack hitboxes. */
  showHitboxes: boolean;
  /** Draw platform + blast-zone bounds. */
  showBounds: boolean;
  /** Show a live per-fighter data readout. */
  showFighterInfo: boolean;
}

export const debug: DebugFlags = {
  timeScale: 1,
  gravityScale: 1,
  knockbackScale: 1,
  playerInvincible: false,
  infiniteUlt: false,
  freezeBots: false,
  unlimitedJumps: false,
  showHitboxes: false,
  showBounds: false,
  showFighterInfo: false,
};

export const DEBUG_DEFAULTS: DebugFlags = { ...debug };

/** How a practice-mode training dummy behaves. */
export type TrainingBehavior = 'ai' | 'stand' | 'walk' | 'jump' | 'shield' | 'dodge';

export interface PracticeConfig {
  behavior: TrainingBehavior;
  /** Dummy cannot be knocked back or launched (combo practice). */
  immovable: boolean;
  /** Difficulty used when behavior is 'ai'. */
  difficulty: Difficulty;
}

export const practice: PracticeConfig = {
  behavior: 'stand',
  immovable: false,
  difficulty: 'normal',
};

export const PRACTICE_DEFAULTS: PracticeConfig = { ...practice };

/** Restore all live tuning to defaults. */
export function resetDebug(): void {
  Object.assign(debug, DEBUG_DEFAULTS);
}
