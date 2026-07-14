/**
 * Shockwaves — expanding impact rings for heavy hits, knockouts and ultimates.
 *
 * A small object-pool of flat ring meshes that pop outward and fade. Purely
 * cosmetic, but it gives big blows real presence: paired with hitstop and the
 * particle burst, a clean smash reads as a genuine impact. No allocation during
 * combat.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { EventBus } from '@/systems/simulation/events';
import { getFighter } from '@/fighters/fighterData';

const MAX_RINGS = 10;

interface Ring {
  active: boolean;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  maxScale: number;
}

export function Shockwaves({ events }: { events: EventBus }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const cursor = useRef(0);
  const pool = useMemo<Ring[]>(
    () =>
      Array.from({ length: MAX_RINGS }, () => ({
        active: false,
        x: 0,
        y: 0,
        life: 0,
        maxLife: 0.4,
        maxScale: 2,
      })),
    [],
  );
  const colors = useRef<THREE.Color[]>(
    Array.from({ length: MAX_RINGS }, () => new THREE.Color('#ffffff')),
  );

  useEffect(() => {
    const spawn = (x: number, y: number, maxScale: number, maxLife: number, color: string): void => {
      const idx = cursor.current;
      cursor.current = (cursor.current + 1) % MAX_RINGS;
      const r = pool[idx];
      r.active = true;
      r.x = x;
      r.y = y;
      r.life = 0;
      r.maxLife = maxLife;
      r.maxScale = maxScale;
      colors.current[idx].set(color);
    };
    const unsub = events.subscribe((e) => {
      switch (e.type) {
        case 'hit':
          if (e.power > 9) spawn(e.pos.x, e.pos.y, 1.2 + Math.min(e.power, 26) * 0.09, 0.34, getFighter(e.attackerId).appearance.accent);
          break;
        case 'knockout':
          spawn(e.pos.x, e.pos.y, 4.5, 0.6, '#ff5d73');
          break;
        case 'ultimate':
          spawn(e.pos.x, e.pos.y, 4, 0.55, getFighter(e.fighterId).appearance.accent);
          break;
      }
    });
    return unsub;
  }, [events, pool]);

  useFrame(() => {
    for (let i = 0; i < pool.length; i++) {
      const r = pool[i];
      const m = meshes.current[i];
      const mat = mats.current[i];
      if (!m || !mat) continue;
      if (!r.active) {
        m.visible = false;
        continue;
      }
      // Advance on wall-clock so it plays through hitstop freezes too.
      r.life += 1 / 60;
      const t = r.life / r.maxLife;
      if (t >= 1) {
        r.active = false;
        m.visible = false;
        continue;
      }
      m.visible = true;
      // Ease-out expansion, quick fade.
      const eased = 1 - Math.pow(1 - t, 2);
      const s = 0.2 + eased * r.maxScale;
      m.position.set(r.x, r.y, 0.65);
      m.scale.set(s, s, s);
      mat.color.copy(colors.current[i]);
      mat.opacity = (1 - t) * 0.7;
    }
  });

  return (
    <>
      {pool.map((_, i) => (
        <mesh key={i} ref={(el) => (meshes.current[i] = el)} visible={false}>
          <ringGeometry args={[0.72, 1, 32]} />
          <meshBasicMaterial
            ref={(mm) => (mats.current[i] = mm as THREE.MeshBasicMaterial | null)}
            color="#ffffff"
            transparent
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}
