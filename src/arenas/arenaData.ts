/**
 * Arena registry — every stage is now implemented and selectable.
 *
 * Each arena is a single self-contained `ArenaConfig`: collision layout, blast
 * zone, spawns and a visual `theme`. The renderer reads the theme generically,
 * so adding another arena is still just one entry here plus (optionally) a new
 * decoration case in `ThemedArena`.
 */
import type { ArenaConfig, ArenaTheme, Platform, Vec2 } from '@/core/types';

/** Shared blast zone used by most stages. */
const STANDARD_BLAST = { left: -22, right: 22, top: 20, bottom: -16 };

/** A few reusable platform layouts so stages feel distinct but balanced. */
const LAYOUTS: Record<string, { platforms: Platform[]; spawns: Vec2[] }> = {
  classic: {
    platforms: [
      { x: 0, y: 0, width: 14, height: 1.2, passThrough: false },
      { x: -6.5, y: 3.5, width: 4, height: 0.6, passThrough: true },
      { x: 6.5, y: 3.5, width: 4, height: 0.6, passThrough: true },
      { x: 0, y: 6.2, width: 5, height: 0.6, passThrough: true },
    ],
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
  },
  wide: {
    platforms: [
      { x: 0, y: 0, width: 17, height: 1.2, passThrough: false },
      { x: -5, y: 4, width: 5, height: 0.6, passThrough: true },
      { x: 5, y: 4, width: 5, height: 0.6, passThrough: true },
    ],
    spawns: [
      { x: -5, y: 2 },
      { x: 5, y: 2 },
      { x: -2, y: 2 },
      { x: 2, y: 2 },
      { x: -5, y: 5.5 },
      { x: 5, y: 5.5 },
      { x: -7, y: 2 },
      { x: 7, y: 2 },
    ],
  },
  towers: {
    platforms: [
      { x: 0, y: 0, width: 11, height: 1.2, passThrough: false },
      { x: -7.5, y: 3, width: 3.5, height: 0.6, passThrough: true },
      { x: 7.5, y: 3, width: 3.5, height: 0.6, passThrough: true },
      { x: 0, y: 5.6, width: 4.5, height: 0.6, passThrough: true },
    ],
    spawns: [
      { x: -3.5, y: 2 },
      { x: 3.5, y: 2 },
      { x: -7.5, y: 4.5 },
      { x: 7.5, y: 4.5 },
      { x: -1.5, y: 2 },
      { x: 1.5, y: 2 },
      { x: 0, y: 7 },
      { x: 0, y: 2 },
    ],
  },
};

interface ArenaSpec {
  id: string;
  name: string;
  description: string;
  layout: keyof typeof LAYOUTS;
  theme: ArenaTheme;
}

const SPECS: ArenaSpec[] = [
  {
    id: 'skyTemple',
    name: 'Sky Temple',
    description: 'Ancient floating islands adrift above an endless cloud sea.',
    layout: 'classic',
    theme: {
      sky: '#aacbf2',
      fogColor: '#bcd3f2',
      fogNear: 34,
      fogFar: 78,
      platformTop: '#7fce7a',
      platformSide: '#7a5a3a',
      platformUnder: '#5e4630',
      accent: '#ffd54a',
      decoration: 'temple',
    },
  },
  {
    id: 'volcano',
    name: 'Volcano',
    description: 'Charred rock platforms above a churning lake of lava.',
    layout: 'wide',
    theme: {
      sky: '#2a1512',
      fogColor: '#5a2418',
      fogNear: 28,
      fogFar: 70,
      platformTop: '#3a3238',
      platformSide: '#241d22',
      platformUnder: '#17110f',
      accent: '#ff6a2c',
      decoration: 'volcano',
    },
  },
  {
    id: 'cyber',
    name: 'Cyber Arena',
    description: 'Neon platforms suspended in a humming digital void.',
    layout: 'towers',
    theme: {
      sky: '#070914',
      fogColor: '#0b1030',
      fogNear: 30,
      fogFar: 76,
      platformTop: '#1b2450',
      platformSide: '#10163a',
      platformUnder: '#0a0e28',
      accent: '#22e6ff',
      decoration: 'cyber',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Sun-dappled platforms nestled in a towering canopy.',
    layout: 'classic',
    theme: {
      sky: '#bfe3a8',
      fogColor: '#a9d68f',
      fogNear: 30,
      fogFar: 72,
      platformTop: '#6fae52',
      platformSide: '#6b4a2c',
      platformUnder: '#4a3320',
      accent: '#d7ff6a',
      decoration: 'forest',
    },
  },
  {
    id: 'castle',
    name: 'Castle',
    description: 'Crumbling ramparts beneath a brooding storm sky.',
    layout: 'wide',
    theme: {
      sky: '#4a5066',
      fogColor: '#3c4258',
      fogNear: 30,
      fogFar: 74,
      platformTop: '#8b8494',
      platformSide: '#565063',
      platformUnder: '#3a3547',
      accent: '#ffcf4a',
      decoration: 'castle',
    },
  },
  {
    id: 'snow',
    name: 'Snow Mountain',
    description: 'Icy ledges swept by drifting mountain snow.',
    layout: 'towers',
    theme: {
      sky: '#cfe4f5',
      fogColor: '#dcecf8',
      fogNear: 26,
      fogFar: 66,
      platformTop: '#eef6ff',
      platformSide: '#a9c4dc',
      platformUnder: '#7f9bb5',
      accent: '#8fd8ff',
      decoration: 'snow',
    },
  },
  {
    id: 'space',
    name: 'Space Station',
    description: 'Metallic modules orbiting high above a distant planet.',
    layout: 'wide',
    theme: {
      sky: '#03040c',
      fogColor: '#05060f',
      fogNear: 40,
      fogFar: 90,
      platformTop: '#5a6478',
      platformSide: '#3a4152',
      platformUnder: '#232838',
      accent: '#7c9cff',
      decoration: 'space',
    },
  },
  {
    id: 'construction',
    name: 'Construction Site',
    description: 'Steel girders and scaffolding high above the city.',
    layout: 'classic',
    theme: {
      sky: '#a9c2e0',
      fogColor: '#b9cbe0',
      fogNear: 32,
      fogFar: 78,
      platformTop: '#d9a536',
      platformSide: '#9a7526',
      platformUnder: '#6f5420',
      accent: '#ffd200',
      decoration: 'construction',
    },
  },
];

export const ARENAS: ArenaConfig[] = SPECS.map((spec) => ({
  id: spec.id,
  name: spec.name,
  description: spec.description,
  implemented: true,
  platforms: LAYOUTS[spec.layout].platforms,
  spawns: LAYOUTS[spec.layout].spawns,
  blastZone: { ...STANDARD_BLAST },
  theme: spec.theme,
}));

export const ARENA_BY_ID: Record<string, ArenaConfig> = Object.fromEntries(
  ARENAS.map((a) => [a.id, a]),
);

export function getArena(id: string): ArenaConfig {
  return ARENA_BY_ID[id] ?? ARENAS[0];
}
