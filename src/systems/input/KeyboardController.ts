/**
 * Keyboard controller.
 *
 * Translates raw keyboard events into edge-detected `InputFrame`s so the
 * simulation sees a clean "pressed this step" signal for attacks and jumps,
 * and a held signal for movement/shield. Works with an external keyboard on
 * iPad as well as laptop keyboards.
 *
 * Default bindings (from the design doc):
 *   Move: WASD · Jump: Space · Sprint: Shift · Light: J · Heavy: K
 *   Special: L · Ultimate: U · Dash: I · Dodge: H · Shield: G · Pause: P
 */
import { emptyInput, type InputFrame } from './InputState';

export type Action =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jump'
  | 'sprint'
  | 'light'
  | 'heavy'
  | 'special'
  | 'ultimate'
  | 'dash'
  | 'dodge'
  | 'shield'
  | 'pause';

export type Bindings = Record<Action, string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  light: ['KeyJ'],
  heavy: ['KeyK'],
  special: ['KeyL'],
  ultimate: ['KeyU'],
  dash: ['KeyI'],
  dodge: ['KeyH'],
  shield: ['KeyG'],
  pause: ['KeyP', 'Escape'],
};

export class KeyboardController {
  private held = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private bindings: Bindings;
  private onPause?: () => void;

  constructor(bindings: Bindings = DEFAULT_BINDINGS) {
    this.bindings = bindings;
  }

  setPauseHandler(fn: () => void): void {
    this.onPause = fn;
  }

  /** Replace bindings live (e.g. when the player remaps a key in Settings). */
  setBindings(bindings: Bindings): void {
    this.bindings = bindings;
    this.held.clear();
    this.pressedThisFrame.clear();
  }

  attach(): void {
    window.addEventListener('keydown', this.handleDown);
    window.addEventListener('keyup', this.handleUp);
    window.addEventListener('blur', this.handleBlur);
  }

  detach(): void {
    window.removeEventListener('keydown', this.handleDown);
    window.removeEventListener('keyup', this.handleUp);
    window.removeEventListener('blur', this.handleBlur);
    this.held.clear();
    this.pressedThisFrame.clear();
  }

  private handleDown = (e: KeyboardEvent): void => {
    // Prevent the page from scrolling on Space / arrows during play.
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (this.matches('pause', e.code)) {
      if (!e.repeat) this.onPause?.();
      return;
    }
    if (!this.held.has(e.code)) this.pressedThisFrame.add(e.code);
    this.held.add(e.code);
  };

  private handleUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };

  private handleBlur = (): void => {
    this.held.clear();
  };

  private matches(action: Action, code: string): boolean {
    return this.bindings[action].includes(code);
  }

  private anyHeld(action: Action): boolean {
    return this.bindings[action].some((c) => this.held.has(c));
  }

  private anyPressed(action: Action): boolean {
    return this.bindings[action].some((c) => this.pressedThisFrame.has(c));
  }

  /** Build the input frame for this simulation step. */
  sample(): InputFrame {
    const frame = emptyInput();
    frame.moveX = (this.anyHeld('right') ? 1 : 0) - (this.anyHeld('left') ? 1 : 0);
    frame.moveY = (this.anyHeld('up') ? 1 : 0) - (this.anyHeld('down') ? 1 : 0);
    frame.sprint = this.anyHeld('sprint');
    frame.shield = this.anyHeld('shield');
    // Edge-triggered actions.
    frame.jump = this.anyPressed('jump');
    frame.light = this.anyPressed('light');
    frame.heavy = this.anyPressed('heavy');
    frame.special = this.anyPressed('special');
    frame.ultimate = this.anyPressed('ultimate');
    frame.dash = this.anyPressed('dash');
    frame.dodge = this.anyPressed('dodge');
    return frame;
  }

  /** Must be called at the end of each simulation tick to clear edges. */
  endFrame(): void {
    this.pressedThisFrame.clear();
  }
}
