/**
 * Input abstraction.
 *
 * The simulation never reads the keyboard directly. Instead every controllable
 * agent (player or AI) produces an `InputFrame` each step. This makes AI and
 * players interchangeable and keeps the physics/combat systems input-agnostic.
 */

/** A single frame of intent from a controller (human or AI). */
export interface InputFrame {
  /** Horizontal axis, -1..1. */
  moveX: number;
  /** Vertical intent, -1..1 (used for fast-fall / platform drop). */
  moveY: number;
  jump: boolean;
  sprint: boolean;
  light: boolean;
  heavy: boolean;
  special: boolean;
  ultimate: boolean;
  dash: boolean;
  dodge: boolean;
  shield: boolean;
}

/** An input frame with nothing pressed. */
export function emptyInput(): InputFrame {
  return {
    moveX: 0,
    moveY: 0,
    jump: false,
    sprint: false,
    light: false,
    heavy: false,
    special: false,
    ultimate: false,
    dash: false,
    dodge: false,
    shield: false,
  };
}
