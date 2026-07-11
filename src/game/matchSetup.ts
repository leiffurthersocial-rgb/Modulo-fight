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
}

export function buildMatchConfig(sel: MatchSelections): MatchConfig {
  const total = MODE_FIGHTER_COUNT[sel.mode];
  const fighters: FighterSetup[] = [
    { configId: sel.playerFighterId, isPlayer: true, difficulty: 'human' },
  ];

  // Preferred bot ids from the menu, then fill from the rest of the roster.
  const used = new Set<string>([sel.playerFighterId]);
  const preferred = sel.botFighterIds.filter((id) => !used.has(id));
  const fallback = FIGHTERS.map((f) => f.id).filter((id) => !used.has(id));
  const botPool = [...preferred, ...fallback.filter((id) => !preferred.includes(id))];

  // Practice mode uses a gentle training dummy regardless of difficulty.
  const botDifficulty: Difficulty = sel.mode === 'practice' ? 'easy' : sel.difficulty;

  let poolIndex = 0;
  while (fighters.length < total) {
    const id = botPool[poolIndex % botPool.length];
    poolIndex += 1;
    if (used.has(id) && botPool.length >= total) continue;
    used.add(id);
    fighters.push({ configId: id, isPlayer: false, difficulty: botDifficulty });
  }

  return {
    mode: sel.mode,
    arena: getArena(sel.arenaId),
    fighters,
    stocks: sel.stocks,
    timeLimit: sel.timeLimit,
  };
}
