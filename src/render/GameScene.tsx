/**
 * GameScene — everything that lives inside the R3F `<Canvas>`.
 *
 * Assembles lighting, the arena, all fighter views, particles, post-processing
 * and the MatchRunner that drives the simulation. Kept separate from the React
 * DOM overlay (HUD / menus) so the two layers stay cleanly decoupled.
 */
import { Suspense } from 'react';
import type { Quality } from '@/state/settingsStore';
import type { Simulation } from '@/systems/simulation/Simulation';
import { ArenaView } from './arena/ArenaView';
import { FighterView } from './fighter/FighterView';
import { Particles } from './effects/Particles';
import { Lighting } from './scene/Lighting';
import { PostEffects } from './scene/PostEffects';
import { MatchRunner } from './scene/MatchRunner';

interface Props {
  sim: Simulation;
  quality: Quality;
  cameraShake: boolean;
  beginFrame: () => void;
  endFrame: () => void;
  onFinished: () => void;
}

export function GameScene({ sim, quality, cameraShake, beginFrame, endFrame, onFinished }: Props) {
  return (
    <Suspense fallback={null}>
      {/* Sky gradient background. */}
      <color attach="background" args={['#aacbf2']} />

      <Lighting quality={quality} />
      <ArenaView arena={sim.config.arena} />

      {sim.fighters.map((f) => (
        <FighterView key={f.config.id + f.index} runtime={f} />
      ))}

      <Particles events={sim.events} />

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
