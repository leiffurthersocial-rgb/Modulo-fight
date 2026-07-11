/**
 * Builds a concrete `MatchConfig` from the player's menu selections.
 *
 * Fills bot slots deterministically from the roster (skipping the player's
 * pick) so every mode always has a full, varied line-up even if the menu only
 * specified some of them.
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
  practiceOpponentId: string;
}

export function buildMatchConfig(sel: MatchSelections): MatchConfig {
  const fighters: FighterSetup[] = [
    { configId: sel.playerFighterId, isPlayer: true, difficulty: 'human' },
  ];

  // Practice is a two-fighter sandbox: player + one chosen dummy, no time
  // limit and effectively unlimited stocks so it never "ends".
  if (sel.mode === 'practice') {
    fighters.push({ configId: sel.practiceOpponentId, isPlayer: false, difficulty: 'easy' });
    return {
      mode: 'practice',
      arena: getArena(sel.arenaId),
      fighters,
      stocks: 99,
      timeLimit: 0,
    };
  }

  const total = MODE_FIGHTER_COUNT[sel.mode];

  // Preferred bot ids from the menu, then fill from the rest of the roster.
  const used = new Set<string>([sel.playerFighterId]);
  const preferred = sel.botFighterIds.filter((id) => !used.has(id));
  const fallback = FIGHTERS.map((f) => f.id).filter((id) => !used.has(id));
  const botPool = [...preferred, ...fallback.filter((id) => !preferred.includes(id))];

  let poolIndex = 0;
  while (fighters.length < total) {
    const id = botPool[poolIndex % botPool.length];
    poolIndex += 1;
    if (used.has(id) && botPool.length >= total) continue;
    used.add(id);
    fighters.push({ configId: id, isPlayer: false, difficulty: sel.difficulty });
  }

  return {
    mode: sel.mode,
    arena: getArena(sel.arenaId),
    fighters,
    stocks: sel.stocks,
    timeLimit: sel.timeLimit,
  };
}
