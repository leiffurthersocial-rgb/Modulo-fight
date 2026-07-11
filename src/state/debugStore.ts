/**
 * debugStore — reactive mirror of the live-tuning singletons in `core/debug`.
 *
 * The UI reads/writes here; every setter also writes through to the plain
 * `debug` / `practice` objects the simulation reads each tick. This gives the
 * debug menu instant, live control over a running match without coupling the
 * simulation to React.
 */
import { create } from 'zustand';
import {
  debug,
  practice,
  resetDebug,
  type DebugFlags,
  type PracticeConfig,
  type TrainingBehavior,
} from '@/core/debug';

interface DebugStore extends DebugFlags, PracticeConfig {
  /** Whether the debug menu has been unlocked (logo tapped 3×). */
  unlocked: boolean;
  /** Whether the debug overlay is currently open. */
  open: boolean;

  unlock: () => void;
  setOpen: (open: boolean) => void;

  setFlag: <K extends keyof DebugFlags>(key: K, value: DebugFlags[K]) => void;
  setBehavior: (b: TrainingBehavior) => void;
  setImmovable: (v: boolean) => void;
  setPracticeDifficulty: (d: PracticeConfig['difficulty']) => void;
  resetFlags: () => void;
}

export const useDebug = create<DebugStore>((set) => ({
  ...debug,
  ...practice,
  unlocked: false,
  open: false,

  unlock: () => set({ unlocked: true, open: true }),
  setOpen: (open) => set({ open }),

  setFlag: (key, value) => {
    (debug[key] as DebugFlags[typeof key]) = value;
    set({ [key]: value } as Pick<DebugStore, typeof key>);
  },
  setBehavior: (b) => {
    practice.behavior = b;
    set({ behavior: b });
  },
  setImmovable: (v) => {
    practice.immovable = v;
    set({ immovable: v });
  },
  setPracticeDifficulty: (d) => {
    practice.difficulty = d;
    set({ difficulty: d });
  },
  resetFlags: () => {
    resetDebug();
    set({ ...debug });
  },
}));
