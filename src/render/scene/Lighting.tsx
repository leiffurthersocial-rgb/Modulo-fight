/**
 * Lighting — warm key light with soft sky fill, tuned for the voxel look.
 * Shadow map resolution scales with the quality setting for performance.
 */
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import type { ArenaTheme } from '@/core/types';
import type { Quality } from '@/state/settingsStore';

const SHADOW_SIZE: Record<Quality, number> = { low: 0, medium: 1024, high: 2048 };

export function Lighting({ quality, theme }: { quality: Quality; theme: ArenaTheme }) {
  const { scene } = useThree();

  useEffect(() => {
    // Themed fog sells each arena's atmosphere and hides pop-in.
    scene.fog = new THREE.Fog(theme.fogColor, theme.fogNear, theme.fogFar);
    return () => {
      scene.fog = null;
    };
  }, [scene, theme]);

  const shadowSize = SHADOW_SIZE[quality];
  const castShadow = shadowSize > 0;

  return (
    <>
      <hemisphereLight args={['#eaf3ff', '#5a6a55', 0.8]} />
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[10, 18, 10]}
        intensity={2.0}
        color="#fff4dd"
        castShadow={castShadow}
        shadow-mapSize-width={shadowSize || 512}
        shadow-mapSize-height={shadowSize || 512}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={0.5}
        shadow-camera-far={70}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
      {/* Cool rim light from behind for separation. */}
      <directionalLight position={[-8, 6, -12]} intensity={0.6} color="#9ec6ff" />
      {/* Warm accent fill from the front-low, giving faces a soft key. */}
      <pointLight position={[0, 3, 12]} intensity={0.35} color="#ffe6c0" distance={40} decay={2} />
    </>
  );
}
