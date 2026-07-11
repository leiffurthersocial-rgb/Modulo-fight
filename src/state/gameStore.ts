/**
 * gameStore — UI navigation and match-setup state.
 *
 * This holds only what React needs to render menus and the HUD. The live
 * physics/combat state lives in the `Simulation` (plain objects) to avoid
 * re-rendering React on every frame; the HUD reads a throttled snapshot pushed
 * here via `setHudSnapshot`.
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
}

interface GameState {
  screen: Screen;

  // Match setup selections.
  mode: GameMode;
  arenaId: string;
  playerFighterId: string;
  botFighterIds: string[];
  difficulty: Difficulty;
  stocks: number;
  timeLimit: number;
  /** Practice mode: which fighter the training dummy uses. */
  practiceOpponentId: string;

  // HUD snapshot (throttled from the simulation).
  hud: HudSnapshot;

  // Results.
  resultPlacements: { index: number; configId: string; name: string }[];

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
  setPracticeOpponent: (id: string) => void;
  setHudSnapshot: (snap: HudSnapshot) => void;
  setResults: (placements: GameState['resultPlacements']) => void;
  setFps: (fps: number) => void;
}

/** How many total fighters each mode fields (1 player + N bots). */
export const MODE_FIGHTER_COUNT: Record<GameMode, number> = {
  practice: 2,
  '1v1': 2,
  ffa4: 4,
  ffa8: 8,
};

export const useGame = create<GameState>((set) => ({
  screen: 'mainMenu',

  mode: '1v1',
  arenaId: 'skyTemple',
  playerFighterId: 'robin',
  botFighterIds: ['leif'],
  difficulty: 'normal',
  stocks: DEFAULT_STOCKS,
  timeLimit: DEFAULT_TIME_LIMIT,
  practiceOpponentId: 'leif',

  hud: { fighters: [], timeRemaining: DEFAULT_TIME_LIMIT },
  resultPlacements: [],
  fps: 60,

  goto: (screen) => set({ screen }),
  setMode: (mode) => set({ mode }),
  setArena: (arenaId) => set({ arenaId }),
  setPlayerFighter: (playerFighterId) => set({ playerFighterId }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setStocks: (stocks) => set({ stocks }),
  setTimeLimit: (timeLimit) => set({ timeLimit }),
  setBotFighters: (botFighterIds) => set({ botFighterIds }),
  setPracticeOpponent: (practiceOpponentId) => set({ practiceOpponentId }),
  setHudSnapshot: (hud) => set({ hud }),
  setResults: (resultPlacements) => set({ resultPlacements }),
  setFps: (fps) => set({ fps }),
}));
