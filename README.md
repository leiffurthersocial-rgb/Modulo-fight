# Modulo Fight

A modern **3D voxel platform fighter** for the web — inspired by the feel of
Super Smash Bros. Knock your opponents off floating arenas, rack up their damage
percentage, and send them flying past the blast zone. Built to run smoothly at
60 FPS on laptops and iPads (with an external keyboard) in any modern browser.

![Sky Temple arena](https://img.shields.io/badge/arena-Sky%20Temple-7fce7a) ![Fighters](https://img.shields.io/badge/fighters-8-5ad1ff) ![60 FPS](https://img.shields.io/badge/target-60%20FPS-6affb0)

## Features

- **8 unique fighters** — each with distinct stats, a passive, a special, an
  ultimate, a signature silhouette _and a distinct aerial identity_ (floaty
  acrobats, nimble speedsters, brick-like heavies) driven by per-fighter air
  control and gravity (Robin, Leif, Jovan, Leonidas, Erim, Till, Lenni, Tusya).
- **Percentage-based combat** — no health bars. Damage grows knockback; win by
  ring-out. Double jumps, air attacks, dashing, dodging, shielding, hitstun,
  multi-hit flurries and combos.
- **Punchy game-feel** — swept-capsule hitboxes so attacks connect along their
  whole arc, impact freeze-frames (hitstop) scaled by power, directional
  influence to survive knockback, accent-tinted hit sparks, shockwave impact
  rings, landing dust, motion streaks, shield domes and a live combo counter.
- **Readable attacks** — every strike draws a visible swing arc at its real
  hitbox; ultimates telegraph with a converging ground ring, set the fighter
  ablaze in their accent colour, blast an outward shock ring and flash the
  screen — you can't miss one, even zoomed out.
- **Dynamic arena camera** — Smash-style auto-zoom that always keeps every
  fighter framed, with cinematic smoothing and impact shake.
- **Human-like AI** — four difficulty tiers (Easy → Insane) that approach,
  space, dodge, combo, recover from off-stage, use specials/ultimates and switch
  targets.
- **Game modes** — Practice, 1v1, 4-Player FFA, 8-Player FFA.
- **Eight themed arenas** — Sky Temple, Volcano, Cyber Arena, Forest, Castle,
  Snow Mountain, Space Station and Construction Site — each with its own layout,
  colours, fog and decoration set (lava, neon grids, trees, snowfall, stars…).
- **Modern voxel art** — stylized voxel humans with expressive faces, soft
  shadows, ambient light, bloom, fog and drifting clouds.
- **Complete audio system** — procedurally synthesised music and SFX behind a
  clean interface, ready to swap for recorded samples.

## Controls

| Action        | Key         |
| ------------- | ----------- |
| Move          | `W A S D`   |
| Jump / Double | `Space`     |
| Sprint        | `Shift`     |
| Light Attack  | `J`         |
| Heavy Attack  | `K`         |
| Special       | `L`         |
| Ultimate      | `U`         |
| Dash          | `I`         |
| Dodge         | `H`         |
| Shield        | `G`         |
| Pause         | `P` (or `Esc`) |

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # typecheck + production build
npm run preview  # preview the production build
npm run lint     # eslint
npm run format   # prettier
```

## Deployment (Vercel)

The repo ships a `vercel.json` configured for Vite. Import the project into
Vercel and deploy — no extra configuration is required. Output is a static
bundle in `dist/`.

## Architecture

The project is built around a strict separation between the **simulation** (pure
TypeScript, deterministic, no React) and the **presentation** (React Three Fiber
+ DOM). The simulation runs on a fixed timestep and mutates plain objects;
React only reads throttled snapshots, which is what keeps the game at 60 FPS.

```
src/
├── core/            # shared types, constants, math (no dependencies)
├── fighters/        # roster data + attack frame-data templates
├── arenas/          # arena configs (Sky Temple built, others planned)
├── systems/         # engine systems, each independent & testable
│   ├── input/       #   keyboard controller → InputFrame abstraction
│   ├── physics/     #   kinematic platform-fighter movement & collision
│   ├── combat/      #   attacks, hitboxes, knockback, passives
│   ├── ai/          #   difficulty-scaled bot controller
│   ├── camera/      #   dynamic arena framing
│   ├── audio/       #   Web Audio synthesis + event binding
│   └── simulation/  #   the authoritative match runtime + event bus
├── game/            # menu-selections → MatchConfig assembly
├── render/          # R3F components: fighters, arena, effects, scene
├── ui/              # DOM overlays: menus, HUD, pause, results, game host
├── state/           # Zustand stores (game navigation + settings)
└── App.tsx          # screen router
```

### Why custom physics instead of Rapier for characters?

Platform fighters need tight, frame-perfect, deterministic movement rather than
the emergent behaviour of a rigid-body solver — so the character controller is a
custom kinematic system (`systems/physics`). Rapier (`@react-three/rapier`)
remains in the stack for arena props and future destructible geometry.

## Extending the game

The codebase is designed so common additions touch exactly one place:

- **New fighter** — append a `FighterConfig` to `src/fighters/fighterData.ts`.
  It becomes selectable and playable immediately.
- **New arena** — add an `ArenaConfig` to `src/arenas/arenaData.ts` and register
  a renderer in `src/render/arena/ArenaView.tsx`.
- **New attack archetype** — extend `src/fighters/attackTemplates.ts`.
- **Real audio assets** — implement the same methods in `AudioManager`; no
  gameplay code changes.

## Tech stack

TypeScript · React · React Three Fiber · Three.js · @react-three/drei ·
@react-three/postprocessing · Rapier · Zustand · Vite · ESLint · Prettier.

## Roadmap

- Recorded audio + music tracks.
- Items and stage hazards.
- Online multiplayer (the input abstraction is already netcode-friendly).
