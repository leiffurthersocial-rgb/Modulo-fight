/**
 * PostEffects — bloom + subtle vignette for a polished, modern look.
 * Disabled entirely on the "low" quality tier to protect frame-rate on weaker
 * GPUs (e.g. older iPads).
 */
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import type { Quality } from '@/state/settingsStore';

export function PostEffects({ quality }: { quality: Quality }) {
  if (quality === 'low') return null;
  return (
    <EffectComposer enableNormalPass={false} multisampling={quality === 'high' ? 4 : 0}>
      <Bloom
        intensity={quality === 'high' ? 0.85 : 0.55}
        luminanceThreshold={0.55}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.18} darkness={0.6} />
    </EffectComposer>
  );
}
