/**
 * Arena registry.
 *
 * Sky Temple is fully implemented and playable. The remaining arenas are
 * declared with `implemented: false` so the menu can preview them and the
 * team can flesh them out later — the rest of the engine already reads arenas
 * generically from this list, so no new plumbing is needed to ship them.
 */
import type { ArenaConfig } from '@/core/types';

const SKY_TEMPLE: ArenaConfig = {
  id: 'skyTemple',
  name: 'Sky Temple',
  description: 'Ancient floating islands adrift above an endless cloud sea.',
  implemented: true,
  // Main island plus three floating platforms in the XY plane.
  platforms: [
    { x: 0, y: 0, width: 14, height: 1.2, passThrough: false },
    { x: -6.5, y: 3.5, width: 4, height: 0.6, passThrough: true },
    { x: 6.5, y: 3.5, width: 4, height: 0.6, passThrough: true },
    { x: 0, y: 6.2, width: 5, height: 0.6, passThrough: true },
  ],
  blastZone: { left: -22, right: 22, top: 20, bottom: -16 },
  spawns: [
    { x: -4, y: 2 },
    { x: 4, y: 2 },
    { x: -1.5, y: 4.5 },
    { x: 1.5, y: 4.5 },
    { x: -6.5, y: 5 },
    { x: 6.5, y: 5 },
    { x: -2, y: 7.5 },
    { x: 2, y: 7.5 },
  ],
};

/** Placeholder factory for planned-but-unbuilt arenas. */
function planned(id: string, name: string, description: string): ArenaConfig {
  return {
    id,
    name,
    description,
    implemented: false,
    platforms: SKY_TEMPLE.platforms,
    blastZone: SKY_TEMPLE.blastZone,
    spawns: SKY_TEMPLE.spawns,
  };
}

export const ARENAS: ArenaConfig[] = [
  SKY_TEMPLE,
  planned('volcano', 'Volcano', 'Molten platforms over a rising lava tide.'),
  planned('cyber', 'Cyber Arena', 'Neon grids and holographic hazards.'),
  planned('forest', 'Forest', 'Sun-dappled canopy platforms.'),
  planned('castle', 'Castle', 'Crumbling ramparts under a stormy sky.'),
  planned('snow', 'Snow Mountain', 'Icy ledges and drifting snow.'),
  planned('space', 'Space Station', 'Low-gravity modules in orbit.'),
  planned('construction', 'Construction Site', 'Girders, cranes and hazards.'),
];

export const ARENA_BY_ID: Record<string, ArenaConfig> = Object.fromEntries(
  ARENAS.map((a) => [a.id, a]),
);

export function getArena(id: string): ArenaConfig {
  return ARENA_BY_ID[id] ?? SKY_TEMPLE;
}
