/**
 * Particles — an object-pooled hit/impact particle system.
 *
 * A single fixed-size pool of instanced quads is recycled for every burst, so
 * there are zero allocations during combat. It subscribes to the gameplay
 * `EventBus` and spawns bursts for hits, knockouts, specials and ultimates.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { EventBus } from '@/systems/simulation/events';

const MAX_PARTICLES = 260;

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
}

interface Props {
  events: EventBus;
}

export function Particles({ events }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const pool = useMemo<Particle[]>(
    () =>
      Array.from({ length: MAX_PARTICLES }, () => ({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 0.1,
        r: 1,
        g: 1,
        b: 1,
      })),
    [],
  );
  const cursor = useRef(0);

  const spawn = useMemo(
    () =>
      (
        x: number,
        y: number,
        count: number,
        speed: number,
        rgb: [number, number, number],
        size: number,
        life: number,
      ): void => {
        for (let i = 0; i < count; i++) {
          const p = pool[cursor.current];
          cursor.current = (cursor.current + 1) % MAX_PARTICLES;
          const angle = Math.random() * Math.PI * 2;
          const spd = speed * (0.4 + Math.random() * 0.6);
          p.active = true;
          p.x = x;
          p.y = y;
          p.vx = Math.cos(angle) * spd;
          p.vy = Math.sin(angle) * spd;
          p.life = 0;
          p.maxLife = life * (0.7 + Math.random() * 0.6);
          p.size = size * (0.7 + Math.random() * 0.6);
          p.r = rgb[0];
          p.g = rgb[1];
          p.b = rgb[2];
        }
      },
    [pool],
  );

  useEffect(() => {
    const unsub = events.subscribe((e) => {
      switch (e.type) {
        case 'hit':
          spawn(e.pos.x, e.pos.y, Math.min(6 + Math.floor(e.power), 20), e.power * 0.4 + 3, [1, 0.85, 0.4], 0.16, 0.5);
          break;
        case 'knockout':
          spawn(e.pos.x, e.pos.y, 40, 14, [1, 0.4, 0.4], 0.22, 0.9);
          break;
        case 'special':
          spawn(e.pos.x, e.pos.y, 16, 8, [0.5, 0.8, 1], 0.18, 0.6);
          break;
        case 'ultimate':
          spawn(e.pos.x, e.pos.y, 60, 12, [1, 0.9, 0.3], 0.26, 1);
          break;
        case 'shield':
          spawn(e.pos.x, e.pos.y, 8, 4, [0.6, 0.9, 1], 0.14, 0.4);
          break;
      }
    });
    return unsub;
  }, [events, spawn]);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    let i = 0;
    for (const p of pool) {
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy -= 14 * dt; // gravity on sparks
          p.vx *= 0.96;
        }
      }
      const t = p.active ? 1 - p.life / p.maxLife : 0;
      dummy.position.set(p.x, p.y, 0.6);
      dummy.scale.setScalar(p.active ? p.size * t : 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setRGB(p.r, p.g, p.b);
      mesh.setColorAt(i, color);
      i++;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial toneMapped={false} transparent depthWrite={false} />
    </instancedMesh>
  );
}
