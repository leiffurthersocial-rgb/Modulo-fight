/**
 * SkyTemple — the first, fully-built arena.
 *
 * Geometry is derived from the shared `ArenaConfig` so the visuals always match
 * the collision the simulation uses. Decorative elements (temple, pillars,
 * drifting clouds) are layered on top for atmosphere. Adding a new arena means
 * writing a sibling component that reads its own config the same way.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ArenaConfig, Platform } from '@/core/types';

interface Props {
  arena: ArenaConfig;
}

/** A single floating voxel island for one platform. */
function Island({ platform, main }: { platform: Platform; main: boolean }) {
  const topY = platform.y + platform.height / 2;
  return (
    <group position={[platform.x, 0, 0]}>
      {/* Grass / stone top slab. */}
      <mesh position={[0, platform.y, 0]} castShadow receiveShadow>
        <boxGeometry args={[platform.width, platform.height, 4]} />
        <meshStandardMaterial color={main ? '#7fce7a' : '#9ad39a'} roughness={0.85} />
      </mesh>
      {/* Dirt rim. */}
      <mesh position={[0, platform.y - platform.height / 2 - 0.15, 0]} receiveShadow>
        <boxGeometry args={[platform.width * 0.98, 0.3, 3.9]} />
        <meshStandardMaterial color="#7a5a3a" roughness={0.95} />
      </mesh>
      {/* Tapered underside — gives the "floating island" silhouette. */}
      <mesh position={[0, platform.y - platform.height / 2 - 1.4, 0]}>
        <coneGeometry args={[platform.width * 0.42, 2.6, 6]} />
        <meshStandardMaterial color="#5e4630" roughness={1} />
      </mesh>
      {main && <Temple topY={topY} width={platform.width} />}
    </group>
  );
}

/** Ancient temple structure decorating the main island. */
function Temple({ topY, width }: { topY: number; width: number }) {
  const columns = useMemo(() => {
    const xs: number[] = [];
    const half = width / 2 - 1;
    for (let x = -half; x <= half; x += 2.4) xs.push(x);
    return xs;
  }, [width]);

  return (
    <group position={[0, topY, -1.4]}>
      {/* Base steps. */}
      <mesh position={[0, 0.25, 0]} receiveShadow castShadow>
        <boxGeometry args={[width - 1, 0.5, 2.4]} />
        <meshStandardMaterial color="#d9d2c4" roughness={0.8} />
      </mesh>
      {/* Columns. */}
      {columns.map((x, i) => (
        <mesh key={i} position={[x, 2, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.32, 3.2, 8]} />
          <meshStandardMaterial color="#e7e0d2" roughness={0.7} />
        </mesh>
      ))}
      {/* Roof / pediment. */}
      <mesh position={[0, 3.9, 0]} castShadow>
        <boxGeometry args={[width - 0.4, 0.6, 2.8]} />
        <meshStandardMaterial color="#c9b98f" roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh position={[0, 4.5, 0]} castShadow>
        <boxGeometry args={[width - 1.4, 0.5, 2.4]} />
        <meshStandardMaterial color="#caa94f" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}

/** Tall decorative pillars flanking the stage in the background. */
function Pillars() {
  const positions = useMemo<[number, number, number][]>(
    () => [
      [-11, -6, -6],
      [11, -6, -6],
      [-15, -10, -9],
      [15, -10, -9],
    ],
    [],
  );
  return (
    <>
      {positions.map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <boxGeometry args={[1.4, 16, 1.4]} />
          <meshStandardMaterial color="#b8ac8e" roughness={0.8} />
        </mesh>
      ))}
    </>
  );
}

/** Drifting volumetric-ish clouds made of soft overlapping spheres. */
function Clouds() {
  const group = useRef<THREE.Group>(null!);
  const puffs = useMemo(() => {
    const arr: { pos: [number, number, number]; scale: number; speed: number }[] = [];
    for (let i = 0; i < 14; i++) {
      arr.push({
        pos: [(Math.random() - 0.5) * 60, -8 + Math.random() * 24, -12 - Math.random() * 14],
        scale: 2 + Math.random() * 4,
        speed: 0.3 + Math.random() * 0.6,
      });
    }
    return arr;
  }, []);

  useFrame((_, dt) => {
    if (!group.current) return;
    for (let i = 0; i < group.current.children.length; i++) {
      const child = group.current.children[i];
      child.position.x += puffs[i].speed * dt;
      if (child.position.x > 34) child.position.x = -34;
    }
  });

  return (
    <group ref={group}>
      {puffs.map((p, i) => (
        <mesh key={i} position={p.pos} scale={p.scale}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color="#eef4ff" roughness={1} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

export function SkyTemple({ arena }: Props) {
  return (
    <group>
      {arena.platforms.map((p, i) => (
        <Island key={i} platform={p} main={i === 0} />
      ))}
      <Pillars />
      <Clouds />
      {/* A large soft cloud floor far below to sell the "endless sky" void. */}
      <mesh position={[0, -14, -8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 60]} />
        <meshStandardMaterial color="#dce8ff" roughness={1} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
