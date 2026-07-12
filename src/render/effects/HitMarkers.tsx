/**
 * HitMarkers — a pooled, in-world impact indicator (an "X" crosshair) that pops
 * and fades at each hit location, scaled by the hit's power. Purely cosmetic
 * feedback, toggled by the "Hit Markers" setting. Object-pooled: no allocation
 * during combat.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { EventBus } from '@/systems/simulation/events';

const MAX_MARKERS = 14;

interface Marker {
  active: boolean;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
}

export function HitMarkers({ events }: { events: EventBus }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  // Each marker owns two bar materials (the two strokes of the "X").
  const mats = useRef<THREE.MeshBasicMaterial[][]>([]);
  const cursor = useRef(0);
  const pool = useMemo<Marker[]>(
    () =>
      Array.from({ length: MAX_MARKERS }, () => ({
        active: false,
        x: 0,
        y: 0,
        life: 0,
        maxLife: 0.3,
        size: 1,
      })),
    [],
  );

  useEffect(() => {
    const unsub = events.subscribe((e) => {
      if (e.type !== 'hit') return;
      const m = pool[cursor.current];
      cursor.current = (cursor.current + 1) % MAX_MARKERS;
      m.active = true;
      m.x = e.pos.x;
      m.y = e.pos.y;
      m.life = 0;
      m.maxLife = 0.3;
      // Bigger, longer marker for heavier hits.
      m.size = 0.45 + Math.min(e.power, 24) * 0.03;
    });
    return unsub;
  }, [events, pool]);

  useFrame((_, dt) => {
    for (let i = 0; i < pool.length; i++) {
      const m = pool[i];
      const g = groups.current[i];
      const pair = mats.current[i];
      if (!g || !pair) continue;
      if (!m.active) {
        g.visible = false;
        continue;
      }
      m.life += dt;
      const t = m.life / m.maxLife;
      if (t >= 1) {
        m.active = false;
        g.visible = false;
        continue;
      }
      g.visible = true;
      // Quick pop outward then settle, with a slight spin.
      const pop = 1 + (1 - Math.pow(1 - Math.min(t * 2, 1), 2)) * 0.6;
      g.position.set(m.x, m.y, 0.7);
      g.scale.setScalar(m.size * pop);
      g.rotation.z = Math.PI / 4 + t * 0.6;
      const opacity = 1 - t;
      for (const mat of pair) mat.opacity = opacity;
    }
  });

  const collect = (i: number, mm: THREE.MeshBasicMaterial | null): void => {
    if (!mm) return;
    const arr = (mats.current[i] ??= []);
    if (!arr.includes(mm)) arr.push(mm);
  };

  return (
    <>
      {pool.map((_, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} visible={false}>
          <mesh>
            <boxGeometry args={[0.9, 0.16, 0.05]} />
            <meshBasicMaterial
              ref={(mm) => collect(i, mm as THREE.MeshBasicMaterial | null)}
              color="#ffffff"
              transparent
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.9, 0.16, 0.05]} />
            <meshBasicMaterial
              ref={(mm) => collect(i, mm as THREE.MeshBasicMaterial | null)}
              color="#ffffff"
              transparent
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}
