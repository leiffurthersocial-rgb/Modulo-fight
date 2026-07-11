/**
 * Builds a concrete `MatchConfig` from the player's menu selections.
 *
 * - 1v1 uses the chosen opponent (or a random one when set to "random"), so the
 *   duel is never always the same fighter.
 * - FFA fills bot slots from a shuffled roster (excluding the player) for variety.
 * - Practice is a two-fighter sandbox with a chosen dummy and chosen stock count.
 */
import type { Difficulty, GameMode } from '@/core/types';
import { getArena } from '@/arenas/arenaData';
import { FIGHTERS } from '@/fighters/fighterData';
import { MODE_FIGHTER_COUNT } from '@/state/gameStore';
import type { FighterSetup, MatchConfig } from '@/systems/simulation/Simulation';

export interface MatchSelections {
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

/** Fisher–Yates shuffle (returns a new array). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomOpponent(excludeId: string): string {
  const pool = FIGHTERS.map((f) => f.id).filter((id) => id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buildMatchConfig(sel: MatchSelections): MatchConfig {
  const arena = getArena(sel.arenaId);
  const player: FighterSetup = {
    configId: sel.playerFighterId,
    isPlayer: true,
    difficulty: 'human',
  };

  // --- Practice: two-fighter sandbox -------------------------------------
  if (sel.mode === 'practice') {
    return {
      mode: 'practice',
      arena,
      fighters: [
        player,
        { configId: sel.practiceOpponentId, isPlayer: false, difficulty: 'easy' },
      ],
      stocks: sel.practiceStocks,
      timeLimit: 0,
    };
  }

  // --- 1v1: chosen (or random) opponent ----------------------------------
  if (sel.mode === '1v1') {
    const oppId =
      sel.duelOpponentId === 'random'
        ? randomOpponent(sel.playerFighterId)
        : sel.duelOpponentId;
    return {
      mode: '1v1',
      arena,
      fighters: [player, { configId: oppId, isPlayer: false, difficulty: sel.difficulty }],
      stocks: sel.stocks,
      timeLimit: sel.timeLimit,
    };
  }

  // --- FFA: shuffled roster fill -----------------------------------------
  const total = MODE_FIGHTER_COUNT[sel.mode];
  const pool = shuffle(FIGHTERS.map((f) => f.id).filter((id) => id !== sel.playerFighterId));
  const fighters: FighterSetup[] = [player];
  let i = 0;
  while (fighters.length < total) {
    fighters.push({ configId: pool[i % pool.length], isPlayer: false, difficulty: sel.difficulty });
    i += 1;
  }

  return { mode: sel.mode, arena, fighters, stocks: sel.stocks, timeLimit: sel.timeLimit };
}
