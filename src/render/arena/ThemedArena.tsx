/**
 * ThemedArena — a single, data-driven renderer for every stage.
 *
 * Platform geometry is derived from the shared `ArenaConfig` (so visuals always
 * match collision), coloured by the arena's `theme`, and topped with a
 * decoration set (temple, volcano, cyber, …) plus matching ambient effects.
 * Adding a new stage means adding a config entry and, optionally, one more
 * `case` in the decoration switch below.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ArenaConfig, ArenaTheme, Platform } from '@/core/types';

interface Props {
  arena: ArenaConfig;
}

/** A themed floating island for one collision platform. */
function Island({
  platform,
  theme,
  main,
  glowEdges,
}: {
  platform: Platform;
  theme: ArenaTheme;
  main: boolean;
  glowEdges: boolean;
}) {
  const topY = platform.y + platform.height / 2;
  return (
    <group position={[platform.x, 0, 0]}>
      <mesh position={[0, platform.y, 0]} castShadow receiveShadow>
        <boxGeometry args={[platform.width, platform.height, 4]} />
        <meshStandardMaterial color={theme.platformTop} roughness={0.82} metalness={0.05} />
      </mesh>
      {/* Neon / accent edge strip. */}
      {glowEdges && (
        <mesh position={[0, topY + 0.03, 2.02]}>
          <boxGeometry args={[platform.width, 0.12, 0.12]} />
          <meshBasicMaterial color={theme.accent} toneMapped={false} />
        </mesh>
      )}
      <mesh position={[0, platform.y - platform.height / 2 - 0.15, 0]} receiveShadow>
        <boxGeometry args={[platform.width * 0.98, 0.3, 3.9]} />
        <meshStandardMaterial color={theme.platformSide} roughness={0.95} />
      </mesh>
      {/* Underside taper — flattened in Z and pushed behind the play plane so
          it decorates the island without ever occluding the fighters. */}
      <mesh
        position={[0, platform.y - platform.height / 2 - 1.4, -1.5]}
        scale={[1, 1, 0.32]}
      >
        <coneGeometry args={[platform.width * 0.42, 2.6, main ? 6 : 5]} />
        <meshStandardMaterial color={theme.platformUnder} roughness={1} />
      </mesh>
    </group>
  );
}

/** Generic drifting/rising particle field used for embers, snow and stars. */
function ParticleField({
  count,
  color,
  size,
  spread,
  driftX,
  driftY,
  emissive,
}: {
  count: number;
  color: string;
  size: number;
  spread: { x: number; y: number; z: [number, number] };
  driftX: number;
  driftY: number;
  emissive: boolean;
}) {
  const ref = useRef<THREE.Group>(null!);
  const specs = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * spread.x,
        y: (Math.random() - 0.5) * spread.y,
        z: spread.z[0] + Math.random() * (spread.z[1] - spread.z[0]),
        s: size * (0.5 + Math.random()),
        phase: Math.random() * Math.PI * 2,
      })),
    [count, size, spread],
  );

  useFrame((_, dt) => {
    if (!ref.current) return;
    for (let i = 0; i < ref.current.children.length; i++) {
      const c = ref.current.children[i];
      c.position.x += (driftX + Math.sin(specs[i].phase + performance.now() / 900) * 0.3) * dt;
      c.position.y += driftY * dt;
      if (driftY > 0 && c.position.y > spread.y / 2) c.position.y = -spread.y / 2;
      if (driftY < 0 && c.position.y < -spread.y / 2) c.position.y = spread.y / 2;
      if (c.position.x > spread.x / 2) c.position.x = -spread.x / 2;
      if (c.position.x < -spread.x / 2) c.position.x = spread.x / 2;
    }
  });

  return (
    <group ref={ref}>
      {specs.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]} scale={s.s}>
          <sphereGeometry args={[1, 6, 6]} />
          {emissive ? (
            <meshBasicMaterial color={color} toneMapped={false} />
          ) : (
            <meshStandardMaterial color={color} roughness={1} transparent opacity={0.85} />
          )}
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * Decoration sets                                                     *
 * ------------------------------------------------------------------ */

function TempleDeco({ arena, theme }: { arena: ArenaConfig; theme: ArenaTheme }) {
  const main = arena.platforms[0];
  const columns = useMemo(() => {
    const xs: number[] = [];
    const half = main.width / 2 - 1;
    for (let x = -half; x <= half; x += 2.4) xs.push(x);
    return xs;
  }, [main.width]);
  const clouds = useMemo(
    () =>
      Array.from({ length: 14 }, () => ({
        pos: [(Math.random() - 0.5) * 60, -8 + Math.random() * 24, -12 - Math.random() * 14] as [
          number,
          number,
          number,
        ],
        scale: 2 + Math.random() * 4,
      })),
    [],
  );
  return (
    <group>
      <group position={[main.x, main.y + main.height / 2, -1.4]}>
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[main.width - 1, 0.5, 2.4]} />
          <meshStandardMaterial color="#d9d2c4" roughness={0.8} />
        </mesh>
        {columns.map((x, i) => (
          <mesh key={i} position={[x, 2, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.32, 3.2, 8]} />
            <meshStandardMaterial color="#e7e0d2" roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 3.9, 0]} castShadow>
          <boxGeometry args={[main.width - 0.4, 0.6, 2.8]} />
          <meshStandardMaterial color="#c9b98f" roughness={0.6} metalness={0.1} />
        </mesh>
        <mesh position={[0, 4.5, 0]} castShadow>
          <boxGeometry args={[main.width - 1.4, 0.5, 2.4]} />
          <meshStandardMaterial color={theme.accent} roughness={0.4} metalness={0.3} />
        </mesh>
      </group>
      {clouds.map((c, i) => (
        <mesh key={i} position={c.pos} scale={c.scale}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color="#eef4ff" roughness={1} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function VolcanoDeco() {
  const lava = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(({ clock }) => {
    if (lava.current) lava.current.emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 2) * 0.4;
  });
  return (
    <group>
      {/* Lava lake far below (also the visual for the bottom blast zone). */}
      <mesh position={[0, -13, -6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[140, 70]} />
        <meshStandardMaterial
          ref={lava}
          color="#ff4a10"
          emissive="#ff6a2c"
          emissiveIntensity={1.4}
          roughness={0.5}
          toneMapped={false}
        />
      </mesh>
      {/* Background volcano cones. */}
      {[
        [-18, -8, -22],
        [16, -9, -24],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <coneGeometry args={[10, 16, 8]} />
          <meshStandardMaterial color="#2a1e1a" roughness={1} />
        </mesh>
      ))}
      <ParticleField
        count={40}
        color="#ff8a3c"
        size={0.14}
        spread={{ x: 40, y: 30, z: [-10, 2] }}
        driftX={0.2}
        driftY={3}
        emissive
      />
    </group>
  );
}

function CyberDeco({ theme }: { theme: ArenaTheme }) {
  const grid = useMemo(() => {
    const lines: [number, number, number, number][] = [];
    for (let x = -30; x <= 30; x += 3) lines.push([x, -14, 0.08, 30]);
    for (let y = -14; y <= 16; y += 3) lines.push([0, y, 60, 0.08]);
    return lines;
  }, []);
  return (
    <group position={[0, 0, -16]}>
      {grid.map((g, i) => (
        <mesh key={i} position={[g[0], g[1], 0]}>
          <boxGeometry args={[g[2], g[3], 0.05]} />
          <meshBasicMaterial color={theme.accent} toneMapped={false} transparent opacity={0.35} />
        </mesh>
      ))}
      {/* Glowing pillars flanking the stage. */}
      {[-13, 13].map((x, i) => (
        <mesh key={i} position={[x, -2, 6]}>
          <boxGeometry args={[0.6, 22, 0.6]} />
          <meshBasicMaterial color={theme.accent} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function ForestDeco({ theme }: { theme: ArenaTheme }) {
  const trees = useMemo<[number, number, number, number][]>(
    () => [
      [-12, -3, -8, 3],
      [12, -3, -9, 3.4],
      [-17, -5, -12, 4],
      [17, -5, -12, 4],
      [0, -2, -14, 5],
    ],
    [],
  );
  return (
    <group>
      {trees.map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh position={[0, s, 0]}>
            <cylinderGeometry args={[0.5 * s * 0.15, 0.7 * s * 0.15, s * 2, 6]} />
            <meshStandardMaterial color="#5a3f24" roughness={1} />
          </mesh>
          <mesh position={[0, s * 2, 0]} castShadow>
            <coneGeometry args={[s, s * 2, 8]} />
            <meshStandardMaterial color={theme.platformTop} roughness={0.9} />
          </mesh>
          <mesh position={[0, s * 2.8, 0]}>
            <coneGeometry args={[s * 0.7, s * 1.5, 8]} />
            <meshStandardMaterial color="#5f9c44" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CastleDeco({ theme }: { theme: ArenaTheme }) {
  const towers = useMemo<[number, number][]>(
    () => [
      [-10, -2],
      [10, -2],
    ],
    [],
  );
  return (
    <group>
      {towers.map(([x, z], i) => (
        <group key={i} position={[x, -4, z - 4]}>
          <mesh castShadow>
            <cylinderGeometry args={[1.6, 1.8, 16, 10]} />
            <meshStandardMaterial color={theme.platformTop} roughness={0.85} />
          </mesh>
          {/* Battlements. */}
          {Array.from({ length: 8 }).map((_, j) => {
            const a = (j / 8) * Math.PI * 2;
            return (
              <mesh key={j} position={[Math.cos(a) * 1.6, 8.2, Math.sin(a) * 1.6]}>
                <boxGeometry args={[0.5, 0.8, 0.5]} />
                <meshStandardMaterial color={theme.platformSide} roughness={0.9} />
              </mesh>
            );
          })}
          {/* Flag. */}
          <mesh position={[0, 9.5, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 3, 5]} />
            <meshStandardMaterial color="#3a3547" />
          </mesh>
          <mesh position={[0.7, 10.4, 0]}>
            <boxGeometry args={[1.4, 0.8, 0.05]} />
            <meshStandardMaterial color={theme.accent} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function SnowDeco({ theme }: { theme: ArenaTheme }) {
  const trees = useMemo<[number, number, number][]>(
    () => [
      [-12, -3, -8],
      [13, -3, -9],
      [-18, -5, -13],
      [18, -5, -13],
    ],
    [],
  );
  return (
    <group>
      {trees.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh position={[0, 2, 0]}>
            <cylinderGeometry args={[0.25, 0.35, 4, 6]} />
            <meshStandardMaterial color="#5a3f24" roughness={1} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[0, 3 + k * 1.2, 0]}>
              <coneGeometry args={[2.4 - k * 0.6, 1.8, 8]} />
              <meshStandardMaterial color={k === 0 ? '#3f6f4a' : theme.platformTop} roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
      <ParticleField
        count={60}
        color="#ffffff"
        size={0.1}
        spread={{ x: 44, y: 34, z: [-10, 4] }}
        driftX={0.4}
        driftY={-2}
        emissive={false}
      />
    </group>
  );
}

function SpaceDeco({ theme }: { theme: ArenaTheme }) {
  return (
    <group>
      {/* Distant planet. */}
      <mesh position={[-14, 9, -30]}>
        <sphereGeometry args={[6, 24, 24]} />
        <meshStandardMaterial color="#4a6db0" roughness={0.8} emissive="#12203f" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[-14, 9, -30]} rotation={[Math.PI / 2.4, 0, 0.3]}>
        <torusGeometry args={[9, 0.4, 8, 48]} />
        <meshBasicMaterial color={theme.accent} toneMapped={false} transparent opacity={0.5} />
      </mesh>
      {/* Asteroids. */}
      {[
        [14, 6, -18],
        [10, -6, -16],
        [-8, 12, -20],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <dodecahedronGeometry args={[1.2, 0]} />
          <meshStandardMaterial color="#5a5f6e" roughness={1} />
        </mesh>
      ))}
      <ParticleField
        count={80}
        color="#ffffff"
        size={0.08}
        spread={{ x: 60, y: 44, z: [-25, -6] }}
        driftX={0.05}
        driftY={0}
        emissive
      />
    </group>
  );
}

function ConstructionDeco({ theme }: { theme: ArenaTheme }) {
  const beams = useMemo<[number, number, number, number, number][]>(
    () => [
      [-13, -6, -6, 0.6, 20],
      [13, -6, -6, 0.6, 20],
      [0, 9, -8, 26, 0.6],
      [-8, -2, -7, 0.5, 8],
      [8, -2, -7, 0.5, 8],
    ],
    [],
  );
  return (
    <group>
      {beams.map(([x, y, z, w, h], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <boxGeometry args={[w, h, w]} />
          <meshStandardMaterial color={theme.platformTop} roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      {/* Hazard cones sit well behind the play plane so they decorate without
          ever blocking the fighters. */}
      {[-7, 7].map((x, i) => (
        <group key={i} position={[x, -5.6, -6]}>
          <mesh>
            <coneGeometry args={[0.4, 0.9, 8]} />
            <meshStandardMaterial color="#ff6a00" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <torusGeometry args={[0.28, 0.06, 6, 12]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Decoration({ arena }: { arena: ArenaConfig }) {
  const t = arena.theme;
  switch (t.decoration) {
    case 'temple':
      return <TempleDeco arena={arena} theme={t} />;
    case 'volcano':
      return <VolcanoDeco />;
    case 'cyber':
      return <CyberDeco theme={t} />;
    case 'forest':
      return <ForestDeco theme={t} />;
    case 'castle':
      return <CastleDeco theme={t} />;
    case 'snow':
      return <SnowDeco theme={t} />;
    case 'space':
      return <SpaceDeco theme={t} />;
    case 'construction':
      return <ConstructionDeco theme={t} />;
    default:
      return null;
  }
}

export function ThemedArena({ arena }: Props) {
  const t = arena.theme;
  const glowEdges = t.decoration === 'cyber';
  return (
    <group>
      {arena.platforms.map((p, i) => (
        <Island key={i} platform={p} theme={t} main={i === 0} glowEdges={glowEdges} />
      ))}
      <Decoration arena={arena} />
    </group>
  );
}
