/**
 * Arena registry — every stage is implemented, and each now has a genuinely
 * distinct layout: different main-platform size, number and placement of
 * floating islands, and blast-zone dimensions. A single config entry (plus an
 * optional decoration case in `ThemedArena`) is all a new stage needs.
 */
import type { ArenaConfig, ArenaTheme, BlastZone, Platform, Vec2 } from '@/core/types';

interface ArenaSpec {
  id: string;
  name: string;
  description: string;
  platforms: Platform[];
  blastZone: BlastZone;
  spawns: Vec2[];
  theme: ArenaTheme;
}

/** Build 8 evenly-spread spawn points around a set of platforms. */
function spawnsFor(platforms: Platform[]): Vec2[] {
  const main = platforms[0];
  const pts: Vec2[] = [
    { x: main.x - main.width * 0.28, y: main.y + 2 },
    { x: main.x + main.width * 0.28, y: main.y + 2 },
    { x: main.x - main.width * 0.12, y: main.y + 2 },
    { x: main.x + main.width * 0.12, y: main.y + 2 },
  ];
  for (const p of platforms.slice(1)) {
    pts.push({ x: p.x, y: p.y + 1.5 });
  }
  while (pts.length < 8) pts.push({ x: main.x, y: main.y + 3 });
  return pts;
}

const SPECS: ArenaSpec[] = [
  {
    id: 'skyTemple',
    name: 'Sky Temple',
    description: 'A classic medium stage — ancient islands adrift in a cloud sea.',
    platforms: [
      { x: 0, y: 0, width: 14, height: 1.2, passThrough: false },
      { x: -6.5, y: 3.5, width: 4, height: 0.6, passThrough: true },
      { x: 6.5, y: 3.5, width: 4, height: 0.6, passThrough: true },
      { x: 0, y: 6.2, width: 5, height: 0.6, passThrough: true },
    ],
    blastZone: { left: -22, right: 22, top: 20, bottom: -16 },
    spawns: [],
    theme: {
      sky: '#aacbf2', fogColor: '#bcd3f2', fogNear: 34, fogFar: 78,
      platformTop: '#7fce7a', platformSide: '#7a5a3a', platformUnder: '#5e4630',
      accent: '#ffd54a', decoration: 'temple',
    },
  },
  {
    id: 'volcano',
    name: 'Volcano',
    description: 'A wide, open arena on a broad rock over a rising lava lake.',
    platforms: [
      { x: 0, y: 0, width: 19, height: 1.4, passThrough: false },
      { x: -5.5, y: 4.2, width: 5, height: 0.6, passThrough: true },
      { x: 5.5, y: 4.2, width: 5, height: 0.6, passThrough: true },
    ],
    blastZone: { left: -25, right: 25, top: 18, bottom: -12 },
    spawns: [],
    theme: {
      sky: '#2a1512', fogColor: '#5a2418', fogNear: 28, fogFar: 70,
      platformTop: '#3a3238', platformSide: '#241d22', platformUnder: '#17110f',
      accent: '#ff6a2c', decoration: 'volcano',
    },
  },
  {
    id: 'cyber',
    name: 'Cyber Arena',
    description: 'A compact, tall stage — tight platforms stacked in a neon void.',
    platforms: [
      { x: 0, y: 0, width: 9, height: 1.2, passThrough: false },
      { x: -5, y: 3, width: 3.5, height: 0.5, passThrough: true },
      { x: 5, y: 3, width: 3.5, height: 0.5, passThrough: true },
      { x: 0, y: 5.4, width: 4, height: 0.5, passThrough: true },
      { x: 0, y: 8, width: 2.6, height: 0.5, passThrough: true },
    ],
    blastZone: { left: -17, right: 17, top: 24, bottom: -14 },
    spawns: [],
    theme: {
      sky: '#070914', fogColor: '#0b1030', fogNear: 30, fogFar: 76,
      platformTop: '#1b2450', platformSide: '#10163a', platformUnder: '#0a0e28',
      accent: '#22e6ff', decoration: 'cyber',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'An asymmetric stage tucked into a sunlit canopy.',
    platforms: [
      { x: 0, y: 0, width: 13, height: 1.2, passThrough: false },
      { x: -7, y: 3, width: 4.5, height: 0.6, passThrough: true },
      { x: 5, y: 4.4, width: 4, height: 0.6, passThrough: true },
      { x: -2, y: 6.4, width: 3.5, height: 0.6, passThrough: true },
    ],
    blastZone: { left: -21, right: 21, top: 21, bottom: -15 },
    spawns: [],
    theme: {
      sky: '#bfe3a8', fogColor: '#a9d68f', fogNear: 30, fogFar: 72,
      platformTop: '#6fae52', platformSide: '#6b4a2c', platformUnder: '#4a3320',
      accent: '#d7ff6a', decoration: 'forest',
    },
  },
  {
    id: 'castle',
    name: 'Castle',
    description: 'A tiered fortress — high ramparts flank a central keep.',
    platforms: [
      { x: 0, y: 0, width: 15, height: 1.3, passThrough: false },
      { x: -7, y: 4.6, width: 4.5, height: 0.7, passThrough: false },
      { x: 7, y: 4.6, width: 4.5, height: 0.7, passThrough: false },
      { x: 0, y: 7.6, width: 3.2, height: 0.6, passThrough: true },
    ],
    blastZone: { left: -23, right: 23, top: 24, bottom: -15 },
    spawns: [],
    theme: {
      sky: '#4a5066', fogColor: '#3c4258', fogNear: 30, fogFar: 74,
      platformTop: '#8b8494', platformSide: '#565063', platformUnder: '#3a3547',
      accent: '#ffcf4a', decoration: 'castle',
    },
  },
  {
    id: 'snow',
    name: 'Snow Mountain',
    description: 'The widest stage of all — a long, low ridge with distant blast zones.',
    platforms: [
      { x: 0, y: 0, width: 22, height: 1.2, passThrough: false },
      { x: -8, y: 3.4, width: 4, height: 0.5, passThrough: true },
      { x: 8, y: 3.4, width: 4, height: 0.5, passThrough: true },
      { x: 0, y: 5, width: 5, height: 0.5, passThrough: true },
    ],
    blastZone: { left: -28, right: 28, top: 20, bottom: -14 },
    spawns: [],
    theme: {
      sky: '#cfe4f5', fogColor: '#dcecf8', fogNear: 26, fogFar: 66,
      platformTop: '#eef6ff', platformSide: '#a9c4dc', platformUnder: '#7f9bb5',
      accent: '#8fd8ff', decoration: 'snow',
    },
  },
  {
    id: 'space',
    name: 'Space Station',
    description: 'Scattered small modules with a tiny main deck — high recovery risk.',
    platforms: [
      { x: 0, y: 0, width: 8, height: 1.1, passThrough: false },
      { x: -7.5, y: 2.6, width: 4, height: 0.5, passThrough: true },
      { x: 7.5, y: 2.6, width: 4, height: 0.5, passThrough: true },
      { x: -3.5, y: 5, width: 3, height: 0.5, passThrough: true },
      { x: 3.5, y: 5, width: 3, height: 0.5, passThrough: true },
    ],
    blastZone: { left: -20, right: 20, top: 24, bottom: -16 },
    spawns: [],
    theme: {
      sky: '#03040c', fogColor: '#05060f', fogNear: 40, fogFar: 90,
      platformTop: '#5a6478', platformSide: '#3a4152', platformUnder: '#232838',
      accent: '#7c9cff', decoration: 'space',
    },
  },
  {
    id: 'construction',
    name: 'Construction Site',
    description: 'A tall, narrow tower of steel beams high above the city.',
    platforms: [
      { x: 0, y: 0, width: 11, height: 1.2, passThrough: false },
      { x: -6, y: 3.4, width: 3, height: 0.5, passThrough: true },
      { x: 6, y: 3.4, width: 3, height: 0.5, passThrough: true },
      { x: 0, y: 6, width: 3.4, height: 0.5, passThrough: true },
      { x: -4, y: 8.4, width: 3, height: 0.5, passThrough: true },
      { x: 4, y: 8.4, width: 3, height: 0.5, passThrough: true },
    ],
    blastZone: { left: -20, right: 20, top: 26, bottom: -15 },
    spawns: [],
    theme: {
      sky: '#a9c2e0', fogColor: '#b9cbe0', fogNear: 32, fogFar: 78,
      platformTop: '#d9a536', platformSide: '#9a7526', platformUnder: '#6f5420',
      accent: '#ffd200', decoration: 'construction',
    },
  },
];

export const ARENAS: ArenaConfig[] = SPECS.map((spec) => ({
  id: spec.id,
  name: spec.name,
  description: spec.description,
  implemented: true,
  platforms: spec.platforms,
  spawns: spawnsFor(spec.platforms),
  blastZone: spec.blastZone,
  theme: spec.theme,
}));

export const ARENA_BY_ID: Record<string, ArenaConfig> = Object.fromEntries(
  ARENAS.map((a) => [a.id, a]),
);

export function getArena(id: string): ArenaConfig {
  return ARENA_BY_ID[id] ?? ARENAS[0];
}
