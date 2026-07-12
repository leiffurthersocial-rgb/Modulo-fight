/**
 * gameStore — UI navigation and match-setup state.
 *
 * This holds only what React needs to render menus and the HUD. The live
 * physics/combat state lives in the `Simulation` (plain objects) to avoid
 * re-rendering React on every frame; the HUD reads a throttled snapshot pushed
 * here via `setHudSnapshot`. Match-setup selections (mode/fighter/arena/etc.)
 * persist across sessions so the player doesn't have to re-pick every time.
 */
import { create } from 'zustand';
import type { Difficulty, GameMode, Screen } from '@/core/types';
import { DEFAULT_STOCKS, DEFAULT_TIME_LIMIT } from '@/core/constants';

/** Per-fighter HUD data pushed from the simulation a few times per second. */
export interface HudFighter {
  index: number;
  configId: string;
  name: string;
  accent: string;
  damage: number;
  stocks: number;
  eliminated: boolean;
  isPlayer: boolean;
  ultCharge: number;
  comboCount: number;
  /** Debug-only live state (populated for the fighter-info overlay). */
  state: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
}

export interface HudSnapshot {
  fighters: HudFighter[];
  timeRemaining: number;
  /** Survive mode: opponents defeated so far and the current wave. */
  score?: number;
  wave?: number;
}

/** Survive mode end-of-run summary shown on the results screen. */
export interface SurviveResult {
  score: number;
  wave: number;
  fighterId: string;
  /** True if the debug menu was unlocked during the run (record not counted). */
  tainted: boolean;
  /** True if this run set a new overall record. */
  isRecord: boolean;
}

/** The subset of state that persists across sessions. */
interface PersistedSelections {
  mode: GameMode;
  arenaId: string;
  playerFighterId: string;
  botFighterIds: string[];
  difficulty: Difficulty;
  stocks: number;
  timeLimit: number;
  duelOpponentId: string;
  practiceOpponentId: string;
  practiceStocks: number;
}

interface GameState extends PersistedSelections {
  screen: Screen;

  // HUD snapshot (throttled from the simulation).
  hud: HudSnapshot;

  // Results.
  resultPlacements: {
    index: number;
    configId: string;
    name: string;
    damageDealt: number;
    damageTaken: number;
    kos: number;
  }[];

  // Survive mode end-of-run summary (null for other modes).
  surviveResult: SurviveResult | null;

  // FPS readout for debug HUD.
  fps: number;

  // Actions.
  goto: (screen: Screen) => void;
  setMode: (mode: GameMode) => void;
  setArena: (id: string) => void;
  setPlayerFighter: (id: string) => void;
  setDifficulty: (d: Difficulty) => void;
  setStocks: (n: number) => void;
  setTimeLimit: (n: number) => void;
  setBotFighters: (ids: string[]) => void;
  setDuelOpponent: (id: string) => void;
  setPracticeOpponent: (id: string) => void;
  setPracticeStocks: (n: number) => void;
  setHudSnapshot: (snap: HudSnapshot) => void;
  setResults: (placements: GameState['resultPlacements']) => void;
  setSurviveResult: (r: SurviveResult | null) => void;
  setFps: (fps: number) => void;
}

/** How many total fighters each mode fields (1 player + N bots). */
export const MODE_FIGHTER_COUNT: Record<GameMode, number> = {
  practice: 2,
  '1v1': 2,
  ffa4: 4,
  ffa8: 8,
  survive: 2,
};

const STORAGE_KEY = 'modulo-fight-selections';

const DEFAULTS: PersistedSelections = {
  mode: '1v1',
  arenaId: 'skyTemple',
  playerFighterId: 'robin',
  botFighterIds: ['leif'],
  difficulty: 'normal',
  stocks: DEFAULT_STOCKS,
  timeLimit: DEFAULT_TIME_LIMIT,
  duelOpponentId: 'random',
  practiceOpponentId: 'leif',
  practiceStocks: 3,
};

function loadSelections(): Partial<PersistedSelections> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistSelections(state: PersistedSelections): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

const saved = loadSelections();

export const useGame = create<GameState>((set, get) => {
  const commit = (): void => {
    const s = get();
    persistSelections({
      mode: s.mode,
      arenaId: s.arenaId,
      playerFighterId: s.playerFighterId,
      botFighterIds: s.botFighterIds,
      difficulty: s.difficulty,
      stocks: s.stocks,
      timeLimit: s.timeLimit,
      duelOpponentId: s.duelOpponentId,
      practiceOpponentId: s.practiceOpponentId,
      practiceStocks: s.practiceStocks,
    });
  };

  return {
    screen: 'mainMenu',

    mode: saved.mode ?? DEFAULTS.mode,
    arenaId: saved.arenaId ?? DEFAULTS.arenaId,
    playerFighterId: saved.playerFighterId ?? DEFAULTS.playerFighterId,
    botFighterIds: saved.botFighterIds ?? DEFAULTS.botFighterIds,
    difficulty: saved.difficulty ?? DEFAULTS.difficulty,
    stocks: saved.stocks ?? DEFAULTS.stocks,
    timeLimit: saved.timeLimit ?? DEFAULTS.timeLimit,
    duelOpponentId: saved.duelOpponentId ?? DEFAULTS.duelOpponentId,
    practiceOpponentId: saved.practiceOpponentId ?? DEFAULTS.practiceOpponentId,
    practiceStocks: saved.practiceStocks ?? DEFAULTS.practiceStocks,

    hud: { fighters: [], timeRemaining: DEFAULT_TIME_LIMIT },
    resultPlacements: [],
    surviveResult: null,
    fps: 60,

    goto: (screen) => set({ screen }),
    setMode: (mode) => {
      set({ mode });
      commit();
    },
    setArena: (arenaId) => {
      set({ arenaId });
      commit();
    },
    setPlayerFighter: (playerFighterId) => {
      set({ playerFighterId });
      commit();
    },
    setDifficulty: (difficulty) => {
      set({ difficulty });
      commit();
    },
    setStocks: (stocks) => {
      set({ stocks });
      commit();
    },
    setTimeLimit: (timeLimit) => {
      set({ timeLimit });
      commit();
    },
    setBotFighters: (botFighterIds) => {
      set({ botFighterIds });
      commit();
    },
    setDuelOpponent: (duelOpponentId) => {
      set({ duelOpponentId });
      commit();
    },
    setPracticeOpponent: (practiceOpponentId) => {
      set({ practiceOpponentId });
      commit();
    },
    setPracticeStocks: (practiceStocks) => {
      set({ practiceStocks });
      commit();
    },
    setHudSnapshot: (hud) => set({ hud }),
    setResults: (resultPlacements) => set({ resultPlacements }),
    setSurviveResult: (surviveResult) => set({ surviveResult }),
    setFps: (fps) => set({ fps }),
  };
});
