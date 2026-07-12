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
import { getFighter } from '@/fighters/fighterData';

const DEFAULT_MAX_PARTICLES = 260;

// Cache of attacker id → accent colour as an [r,g,b] triple, so hit sparks are
// tinted by whoever landed the blow (each fighter's signature colour).
const accentCache = new Map<string, [number, number, number]>();
function accentRgb(id: string): [number, number, number] {
  let rgb = accentCache.get(id);
  if (!rgb) {
    const c = new THREE.Color(getFighter(id).appearance.accent);
    // Brighten slightly so sparks pop against the bloom.
    rgb = [Math.min(1, c.r + 0.25), Math.min(1, c.g + 0.25), Math.min(1, c.b + 0.25)];
    accentCache.set(id, rgb);
  }
  return rgb;
}

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
  /** Pool size; frozen at mount (a mid-match settings change applies next match). */
  maxParticles?: number;
}

export function Particles({ events, maxParticles = DEFAULT_MAX_PARTICLES }: Props) {
  // Frozen at mount: the instancedMesh's buffer count can't change without a
  // full remount, so we lock the pool size to whatever was passed in first.
  const MAX_PARTICLES = useRef(Math.max(20, maxParticles)).current;
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  // MAX_PARTICLES is frozen for this component's lifetime (see the ref above),
  // so it's intentionally omitted from the dependency arrays below.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool],
  );

  // Dust puff: low, wide, sideways sparks that settle — used for landings.
  const spawnDust = useMemo(
    () =>
      (x: number, y: number, count: number): void => {
        for (let i = 0; i < count; i++) {
          const p = pool[cursor.current];
          cursor.current = (cursor.current + 1) % MAX_PARTICLES;
          const dir = Math.random() < 0.5 ? -1 : 1;
          const spd = 1.5 + Math.random() * 3;
          p.active = true;
          p.x = x + (Math.random() - 0.5) * 0.5;
          p.y = y;
          p.vx = dir * spd;
          p.vy = 0.5 + Math.random() * 1.5;
          p.life = 0;
          p.maxLife = 0.3 + Math.random() * 0.25;
          p.size = 0.12 + Math.random() * 0.12;
          const g = 0.72 + Math.random() * 0.12;
          p.r = g;
          p.g = g;
          p.b = g * 0.9;
        }
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool],
  );

  useEffect(() => {
    const unsub = events.subscribe((e) => {
      switch (e.type) {
        case 'hit': {
          // White-hot core spark plus a burst tinted with the attacker's accent.
          spawn(e.pos.x, e.pos.y, Math.min(4 + Math.floor(e.power * 0.5), 12), e.power * 0.45 + 3, [1, 0.96, 0.8], 0.15, 0.4);
          spawn(e.pos.x, e.pos.y, Math.min(6 + Math.floor(e.power), 20), e.power * 0.4 + 3, accentRgb(e.attackerId), 0.16, 0.5);
          break;
        }
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
        case 'land': {
          // Low, wide dust kicked sideways along the ground.
          const n = Math.min(4 + Math.floor((e.power ?? 0) * 0.4), 14);
          spawnDust(e.pos.x, e.pos.y, n);
          break;
        }
      }
    });
    return unsub;
  }, [events, spawn, spawnDust]);

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
