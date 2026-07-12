/**
 * recordsStore — persistent high scores for Survive mode.
 *
 * Tracks the best overall score (and which fighter set it) plus a per-fighter
 * best. Only *untainted* runs (debug menu never unlocked) are ever submitted,
 * so records stay honest — see `GameScreen`'s run-taint tracking.
 */
import { create } from 'zustand';

interface RecordsState {
  bestScore: number;
  bestFighterId: string | null;
  perFighter: Record<string, number>;

  /** Submit a completed, untainted run. Returns true if it set a new best. */
  submit: (fighterId: string, score: number) => boolean;
  reset: () => void;
}

const STORAGE_KEY = 'modulo-fight-records';

interface Persisted {
  bestScore: number;
  bestFighterId: string | null;
  perFighter: Record<string, number>;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { bestScore: 0, bestFighterId: null, perFighter: {} };
}

function persist(state: Persisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

const saved = load();

export const useRecords = create<RecordsState>((set, get) => ({
  bestScore: saved.bestScore,
  bestFighterId: saved.bestFighterId,
  perFighter: saved.perFighter,

  submit: (fighterId, score) => {
    const s = get();
    const prevFighterBest = s.perFighter[fighterId] ?? 0;
    const isFighterBest = score > prevFighterBest;
    const isOverallBest = score > s.bestScore;
    if (!isFighterBest && !isOverallBest) return false;

    const perFighter = { ...s.perFighter };
    if (isFighterBest) perFighter[fighterId] = score;
    const next: Persisted = {
      bestScore: isOverallBest ? score : s.bestScore,
      bestFighterId: isOverallBest ? fighterId : s.bestFighterId,
      perFighter,
    };
    set(next);
    persist(next);
    return isOverallBest;
  },

  reset: () => {
    const empty: Persisted = { bestScore: 0, bestFighterId: null, perFighter: {} };
    set(empty);
    persist(empty);
  },
}));
