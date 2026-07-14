/**
 * Projectiles — renders the simulation's pooled projectile bolts (Erim's
 * Laser Barrage). Each bolt is a stretched, emissive quad in the owner's
 * accent colour with a fading tail. Mirrors the fixed simulation pool, so
 * there are zero allocations during play.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Simulation } from '@/systems/simulation/Simulation';

export function Projectiles({ sim }: { sim: Simulation }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const colors = useMemo(
    () => sim.fighters.map((f) => new THREE.Color(f.config.appearance.accent)),
    [sim],
  );

  useFrame(() => {
    for (let i = 0; i < sim.projectiles.length; i++) {
      const p = sim.projectiles[i];
      const m = meshes.current[i];
      const mat = mats.current[i];
      if (!m || !mat) continue;
      if (!p.active) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      m.position.set(p.x, p.y, 0.4);
      // Stretch along travel direction; fade slightly over lifetime.
      m.scale.set(Math.sign(p.vx) || 1, 1, 1);
      mat.color.copy(colors[p.ownerIndex] ?? colors[0]);
      mat.opacity = Math.min(1, p.life * 3) * 0.95;
    }
  });

  return (
    <>
      {sim.projectiles.map((_, i) => (
        <mesh key={i} ref={(el) => (meshes.current[i] = el)} visible={false}>
          <planeGeometry args={[1.5, 0.28]} />
          <meshBasicMaterial
            ref={(mm) => (mats.current[i] = mm as THREE.MeshBasicMaterial | null)}
            color="#ffffff"
            transparent
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}
