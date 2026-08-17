/**
 * GameScene — everything that lives inside the R3F `<Canvas>`.
 *
 * Assembles lighting, the arena, all fighter views, particles, post-processing
 * and the MatchRunner that drives the simulation. Kept separate from the React
 * DOM overlay (HUD / menus) so the two layers stay cleanly decoupled.
 */
import { Suspense, useEffect, useReducer } from 'react';
import type { Quality } from '@/state/settingsStore';
import type { Simulation } from '@/systems/simulation/Simulation';
import { ArenaView } from './arena/ArenaView';
import { FighterView } from './fighter/FighterView';
import { Particles } from './effects/Particles';
import { Projectiles } from './effects/Projectiles';
import { Shockwaves } from './effects/Shockwaves';
import { StageStrike } from './effects/StageStrike';
import { HitMarkers } from './effects/HitMarkers';
import { DebugOverlay } from './effects/DebugOverlay';
import { Lighting } from './scene/Lighting';
import { PostEffects } from './scene/PostEffects';
import { MatchRunner } from './scene/MatchRunner';

interface Props {
  sim: Simulation;
  quality: Quality;
  cameraShake: boolean;
  hitMarkers: boolean;
  /** Scales ambient/decorative particle counts (1 = full, <1 = battery saver). */
  effectsScale?: number;
  beginFrame: () => void;
  endFrame: () => void;
  onFinished: () => void;
}

/**
 * Fighter views. In Survive the opponent slot is swapped in-place each wave, so
 * we re-render on the `wave` event and key the opponent by wave to remount its
 * voxel model with the new appearance (the player keeps a stable key).
 */
function Fighters({ sim }: { sim: Simulation }) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => sim.events.subscribe((e) => e.type === 'wave' && force()), [sim]);
  // Approximate ground plane for contact shadows = the main platform's surface.
  const main = sim.config.arena.platforms[0];
  const groundY = main.y + main.height / 2;
  return (
    <>
      {sim.fighters.map((f) => (
        <FighterView
          key={f.isPlayer ? 'player' : `opp-${sim.wave}-${f.index}`}
          runtime={f}
          groundY={groundY}
        />
      ))}
    </>
  );
}

export function GameScene({
  sim,
  quality,
  cameraShake,
  hitMarkers,
  effectsScale = 1,
  beginFrame,
  endFrame,
  onFinished,
}: Props) {
  return (
    <Suspense fallback={null}>
      {/* Themed sky background per arena. */}
      <color attach="background" args={[sim.config.arena.theme.sky]} />

      <Lighting quality={quality} theme={sim.config.arena.theme} />
      <ArenaView arena={sim.config.arena} effectsScale={effectsScale} />

      <Fighters sim={sim} />

      {/* Hit-area overlays for the two stage-wide ultimates. Not decorative —
          these are the only attacks whose range the swing arc can't show. */}
      <StageStrike sim={sim} />

      <Particles events={sim.events} maxParticles={Math.max(40, Math.round(260 * effectsScale))} />
      <Projectiles sim={sim} />
      {/* Shockwave rings are pure flourish — skipped entirely in low power. */}
      {effectsScale > 0.3 && <Shockwaves events={sim.events} />}
      {hitMarkers && <HitMarkers events={sim.events} />}
      <DebugOverlay sim={sim} />

      <MatchRunner
        sim={sim}
        beginFrame={beginFrame}
        endFrame={endFrame}
        cameraShake={cameraShake}
        onFinished={onFinished}
      />

      <PostEffects quality={quality} />
    </Suspense>
  );
}
