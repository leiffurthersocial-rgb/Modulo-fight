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
  /** Scales ambient/decorative particle counts (1 = full, <1 = battery saver). */
  effectsScale?: number;
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

/** Flickering emissive flame — torches, braziers. */
function Flame({
  position,
  color = '#ffb03c',
  scale = 1,
}: {
  position: [number, number, number];
  color?: string;
  scale?: number;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const mesh = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const f = 1 + Math.sin(t * 11 + position[0] * 3) * 0.25 + Math.sin(t * 23) * 0.1;
    if (mat.current) mat.current.emissiveIntensity = 1.7 * f;
    if (mesh.current) mesh.current.scale.set(scale * f * 0.9, scale * (0.75 + f * 0.4), scale * f * 0.9);
  });
  return (
    <mesh ref={mesh} position={position}>
      <coneGeometry args={[0.16, 0.44, 6]} />
      <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={1.7} toneMapped={false} />
    </mesh>
  );
}

/** Blinking hazard beacon (construction cranes, antennas). */
function Beacon({ position, color = '#ff3b30' }: { position: [number, number, number]; color?: string }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = Math.sin(clock.elapsedTime * 4) > 0 ? 1 : 0.12;
  });
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.22, 10, 10]} />
      <meshBasicMaterial ref={mat} color={color} toneMapped={false} transparent />
    </mesh>
  );
}

/** Slowly spinning holographic ring (cyber arena). */
function HoloRing({
  position,
  radius,
  color,
  speed,
}: {
  position: [number, number, number];
  radius: number;
  color: string;
  speed: number;
}) {
  const g = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    if (!g.current) return;
    g.current.rotation.y += dt * speed;
    g.current.rotation.x = Math.sin(performance.now() / 2400) * 0.25;
  });
  return (
    <group ref={g} position={position}>
      <mesh>
        <torusGeometry args={[radius, 0.06, 6, 40]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 0.7, 0.045, 6, 36]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

/** Waving aurora ribbon high in the sky (snow arena). */
function Aurora({
  position,
  width,
  color,
  phase,
}: {
  position: [number, number, number];
  width: number;
  color: string;
  phase: number;
}) {
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const mesh = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (mat.current) mat.current.opacity = 0.12 + Math.sin(t * 0.5 + phase) * 0.06 + 0.06;
    if (mesh.current) mesh.current.rotation.z = 0.25 + Math.sin(t * 0.3 + phase) * 0.08;
  });
  return (
    <mesh ref={mesh} position={position} rotation={[0.2, 0, 0.25]}>
      <planeGeometry args={[width, 7, 1, 1]} />
      <meshBasicMaterial ref={mat} color={color} toneMapped={false} transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ *
 * Decoration sets                                                     *
 * ------------------------------------------------------------------ */

function TempleDeco({
  arena,
  theme,
  effectsScale,
}: {
  arena: ArenaConfig;
  theme: ArenaTheme;
  effectsScale: number;
}) {
  const main = arena.platforms[0];
  const columns = useMemo(() => {
    const xs: number[] = [];
    const half = main.width / 2 - 1;
    for (let x = -half; x <= half; x += 2.4) xs.push(x);
    return xs;
  }, [main.width]);
  const cloudCount = Math.max(4, Math.round(14 * effectsScale));
  const clouds = useMemo(
    () =>
      Array.from({ length: cloudCount }, () => ({
        pos: [(Math.random() - 0.5) * 60, -8 + Math.random() * 24, -12 - Math.random() * 14] as [
          number,
          number,
          number,
        ],
        scale: 2 + Math.random() * 4,
      })),
    [cloudCount],
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
        {/* Flickering braziers flanking the temple entrance. */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * (main.width / 2 - 0.4), 0.5, 1.1]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.07, 0.1, 1.5, 6]} />
              <meshStandardMaterial color="#6b5a3a" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.8, 0]}>
              <cylinderGeometry args={[0.2, 0.14, 0.22, 8]} />
              <meshStandardMaterial color="#8a7248" metalness={0.4} roughness={0.5} />
            </mesh>
            <Flame position={[0, 1.12, 0]} />
          </group>
        ))}
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

function VolcanoDeco({ effectsScale }: { effectsScale: number }) {
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
      {/* Background volcano cones, with glowing crater mouths. */}
      {[
        [-18, -8, -22],
        [16, -9, -24],
      ].map((p, i) => (
        <group key={i} position={p as [number, number, number]}>
          <mesh>
            <coneGeometry args={[10, 16, 8]} />
            <meshStandardMaterial color="#2a1e1a" roughness={1} />
          </mesh>
          <mesh position={[0, 7.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.8, 2.4, 12]} />
            <meshBasicMaterial color="#ff5a1c" toneMapped={false} transparent opacity={0.85} />
          </mesh>
        </group>
      ))}
      {/* Glowing magma fissures on the arena rock's front face. */}
      {[
        [-5.5, -0.5, 2.6, 0.09],
        [0.8, -0.9, 1.8, 0.07],
        [5.2, -0.4, 2.2, 0.08],
      ].map(([x, y, w, h], i) => (
        <mesh key={`f${i}`} position={[x, y, 2.02]}>
          <boxGeometry args={[w, h, 0.04]} />
          <meshBasicMaterial color="#ff7a2c" toneMapped={false} />
        </mesh>
      ))}
      {/* Rising embers + slow smoke columns above the cones. */}
      <ParticleField
        count={Math.max(6, Math.round(40 * effectsScale))}
        color="#ff8a3c"
        size={0.14}
        spread={{ x: 40, y: 30, z: [-10, 2] }}
        driftX={0.2}
        driftY={3}
        emissive
      />
      <ParticleField
        count={Math.max(4, Math.round(18 * effectsScale))}
        color="#4a4038"
        size={0.9}
        spread={{ x: 46, y: 30, z: [-28, -18] }}
        driftX={0.4}
        driftY={1.6}
        emissive={false}
      />
    </group>
  );
}

function CyberDeco({ theme, effectsScale }: { theme: ArenaTheme; effectsScale: number }) {
  const grid = useMemo(() => {
    const lines: [number, number, number, number][] = [];
    for (let x = -30; x <= 30; x += 3) lines.push([x, -14, 0.08, 30]);
    for (let y = -14; y <= 16; y += 3) lines.push([0, y, 60, 0.08]);
    return lines;
  }, []);
  return (
    <group>
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
      {/* Slowly rotating holograms floating beside the stage. */}
      <HoloRing position={[-10, 6, -9]} radius={1.6} color={theme.accent} speed={0.5} />
      <HoloRing position={[10, 8, -11]} radius={1.1} color="#b06aff" speed={-0.7} />
      {/* Falling "data rain". */}
      <ParticleField
        count={Math.max(10, Math.round(60 * effectsScale))}
        color={theme.accent}
        size={0.07}
        spread={{ x: 44, y: 32, z: [-14, -4] }}
        driftX={0}
        driftY={-6}
        emissive
      />
    </group>
  );
}

function ForestDeco({ theme, effectsScale }: { theme: ArenaTheme; effectsScale: number }) {
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
  const mushrooms = useMemo<[number, number, number, number][]>(
    () => [
      [-10.4, -3, -6, 1],
      [13.6, -3, -7, 1.3],
      [-1.2, -2, -12.4, 1.6],
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
      {/* Oversized toadstools at the tree roots. */}
      {mushrooms.map(([x, y, z, s], i) => (
        <group key={`m${i}`} position={[x, y, z]} scale={s}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.14, 0.18, 0.6, 6]} />
            <meshStandardMaterial color="#e8dcc8" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.66, 0]}>
            <sphereGeometry args={[0.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#c8402f" roughness={0.8} />
          </mesh>
          <mesh position={[0.16, 0.78, 0.2]}>
            <sphereGeometry args={[0.07, 6, 6]} />
            <meshStandardMaterial color="#f2ead8" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* Drifting falling leaves in two tones. */}
      <ParticleField
        count={Math.max(6, Math.round(30 * effectsScale))}
        color="#8fbf5a"
        size={0.12}
        spread={{ x: 40, y: 26, z: [-12, 2] }}
        driftX={0.7}
        driftY={-1.1}
        emissive={false}
      />
      <ParticleField
        count={Math.max(4, Math.round(18 * effectsScale))}
        color="#d8a03c"
        size={0.11}
        spread={{ x: 40, y: 26, z: [-12, 2] }}
        driftX={0.5}
        driftY={-1.4}
        emissive={false}
      />
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
          {/* Warm candle-lit windows up the tower. */}
          {[-1.5, 1.5, 4.5].map((y, j) => (
            <mesh key={`w${j}`} position={[0, y, 1.64]}>
              <boxGeometry args={[0.34, 0.5, 0.06]} />
              <meshBasicMaterial color="#ffd27a" toneMapped={false} />
            </mesh>
          ))}
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
          {/* Torch at the tower base. */}
          <Flame position={[0, -6.4, 1.9]} scale={0.9} />
        </group>
      ))}
      {/* The keep — a broad gate wall behind the stage. */}
      <group position={[0, -6, -12]}>
        <mesh castShadow>
          <boxGeometry args={[14, 9, 2]} />
          <meshStandardMaterial color={theme.platformSide} roughness={0.95} />
        </mesh>
        {/* Arched gate + portcullis glow. */}
        <mesh position={[0, -1.6, 1.05]}>
          <boxGeometry args={[3.4, 5.4, 0.2]} />
          <meshStandardMaterial color="#241f2e" roughness={1} />
        </mesh>
        <mesh position={[0, -1.4, 1.18]}>
          <boxGeometry args={[2.6, 4.6, 0.05]} />
          <meshBasicMaterial color="#ffb85c" toneMapped={false} transparent opacity={0.35} />
        </mesh>
        {/* Wall-top crenellations. */}
        {[-6, -4, -2, 0, 2, 4, 6].map((x, j) => (
          <mesh key={j} position={[x, 5, 0]}>
            <boxGeometry args={[0.9, 1, 2.1]} />
            <meshStandardMaterial color={theme.platformSide} roughness={0.95} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function SnowDeco({ theme, effectsScale }: { theme: ArenaTheme; effectsScale: number }) {
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
      {/* Aurora ribbons shimmering across the sky. */}
      <Aurora position={[-8, 15, -34]} width={44} color="#7affc9" phase={0} />
      <Aurora position={[10, 18, -38]} width={36} color="#8fb4ff" phase={2.1} />
      {/* A friendly snowman watching from the sidelines. */}
      <group position={[9.5, -2.9, -6]}>
        {[
          [0, 0.55, 0.62],
          [0, 1.45, 0.45],
          [0, 2.15, 0.32],
        ].map(([x, y, r], i) => (
          <mesh key={i} position={[x, y, 0]} castShadow>
            <sphereGeometry args={[r, 12, 10]} />
            <meshStandardMaterial color="#f4f9ff" roughness={0.95} />
          </mesh>
        ))}
        {/* Carrot nose + coal eyes + twig arms. */}
        <mesh position={[0, 2.18, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.06, 0.3, 6]} />
          <meshStandardMaterial color="#ff8a2c" roughness={0.8} />
        </mesh>
        {[-0.11, 0.11].map((x, i) => (
          <mesh key={i} position={[x, 2.3, 0.28]}>
            <sphereGeometry args={[0.035, 6, 6]} />
            <meshStandardMaterial color="#181818" />
          </mesh>
        ))}
        {[-1, 1].map((s, i) => (
          <mesh key={`a${i}`} position={[s * 0.6, 1.5, 0]} rotation={[0, 0, s * -0.7]}>
            <cylinderGeometry args={[0.03, 0.04, 0.9, 5]} />
            <meshStandardMaterial color="#5a3f24" roughness={1} />
          </mesh>
        ))}
      </group>
      <ParticleField
        count={Math.max(8, Math.round(60 * effectsScale))}
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

function SpaceDeco({ theme, effectsScale }: { theme: ArenaTheme; effectsScale: number }) {
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
      {/* Distant nebula glow. */}
      <mesh position={[-22, -4, -46]}>
        <sphereGeometry args={[9, 16, 16]} />
        <meshBasicMaterial color="#7c5cff" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <mesh position={[20, 14, -50]}>
        <sphereGeometry args={[11, 16, 16]} />
        <meshBasicMaterial color="#ff5d9e" transparent opacity={0.06} depthWrite={false} />
      </mesh>
      {/* A drifting satellite with solar panels and a blinking antenna. */}
      <group position={[13, 11, -24]} rotation={[0.15, -0.4, 0.1]}>
        <mesh>
          <boxGeometry args={[1.3, 0.6, 0.6]} />
          <meshStandardMaterial color="#c8ccd8" metalness={0.55} roughness={0.35} />
        </mesh>
        {[-1, 1].map((s, i) => (
          <mesh key={i} position={[s * 1.6, 0, 0]}>
            <boxGeometry args={[1.8, 0.04, 0.8]} />
            <meshStandardMaterial color="#2c4a8a" metalness={0.4} roughness={0.4} emissive="#16295a" emissiveIntensity={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.7, 4]} />
          <meshStandardMaterial color="#8a8f9e" />
        </mesh>
        <Beacon position={[0, 1.05, 0]} color="#ff3b30" />
      </group>
      {/* Star field + fast shooting stars streaking across. */}
      <ParticleField
        count={Math.max(10, Math.round(80 * effectsScale))}
        color="#ffffff"
        size={0.08}
        spread={{ x: 60, y: 44, z: [-25, -6] }}
        driftX={0.05}
        driftY={0}
        emissive
      />
      <ParticleField
        count={Math.max(2, Math.round(6 * effectsScale))}
        color="#cfe6ff"
        size={0.12}
        spread={{ x: 70, y: 36, z: [-34, -14] }}
        driftX={22}
        driftY={-1.5}
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
      {/* Tower crane looming behind the site, warning beacon blinking. */}
      <group position={[-17, -8, -18]}>
        <mesh castShadow>
          <boxGeometry args={[1, 26, 1]} />
          <meshStandardMaterial color={theme.platformTop} metalness={0.4} roughness={0.55} />
        </mesh>
        {/* Jib + counter-jib. */}
        <mesh position={[6.5, 13.2, 0]}>
          <boxGeometry args={[14, 0.6, 0.7]} />
          <meshStandardMaterial color={theme.platformTop} metalness={0.4} roughness={0.55} />
        </mesh>
        <mesh position={[-3.4, 13.2, 0]}>
          <boxGeometry args={[4.6, 0.8, 0.8]} />
          <meshStandardMaterial color={theme.platformSide} metalness={0.4} roughness={0.6} />
        </mesh>
        {/* Cable + hanging girder. */}
        <mesh position={[10.5, 9.7, 0]}>
          <boxGeometry args={[0.06, 6.4, 0.06]} />
          <meshStandardMaterial color="#3a3a40" />
        </mesh>
        <mesh position={[10.5, 6.2, 0]}>
          <boxGeometry args={[2.6, 0.5, 0.5]} />
          <meshStandardMaterial color="#8a2f2f" metalness={0.3} roughness={0.6} />
        </mesh>
        <Beacon position={[0, 13.9, 0]} />
      </group>
      {/* Striped safety barriers near the stage edges. */}
      {[-4, 4].map((x, i) => (
        <group key={`b${i}`} position={[x, -5.5, -6.5]}>
          <mesh>
            <boxGeometry args={[2.4, 0.5, 0.2]} />
            <meshStandardMaterial color="#ff6a00" roughness={0.7} />
          </mesh>
          {[-0.8, 0, 0.8].map((sx, j) => (
            <mesh key={j} position={[sx, 0, 0.11]}>
              <boxGeometry args={[0.32, 0.5, 0.02]} />
              <meshStandardMaterial color="#f2f2f2" roughness={0.7} />
            </mesh>
          ))}
          {[-1, 1].map((s, j) => (
            <mesh key={`l${j}`} position={[s * 1, -0.45, 0]}>
              <boxGeometry args={[0.12, 0.5, 0.12]} />
              <meshStandardMaterial color="#3a3a40" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Decoration({ arena, effectsScale }: { arena: ArenaConfig; effectsScale: number }) {
  const t = arena.theme;
  switch (t.decoration) {
    case 'temple':
      return <TempleDeco arena={arena} theme={t} effectsScale={effectsScale} />;
    case 'volcano':
      return <VolcanoDeco effectsScale={effectsScale} />;
    case 'cyber':
      return <CyberDeco theme={t} effectsScale={effectsScale} />;
    case 'forest':
      return <ForestDeco theme={t} effectsScale={effectsScale} />;
    case 'castle':
      return <CastleDeco theme={t} />;
    case 'snow':
      return <SnowDeco theme={t} effectsScale={effectsScale} />;
    case 'space':
      return <SpaceDeco theme={t} effectsScale={effectsScale} />;
    case 'construction':
      return <ConstructionDeco theme={t} />;
    default:
      return null;
  }
}

export function ThemedArena({ arena, effectsScale = 1 }: Props) {
  const t = arena.theme;
  const glowEdges = t.decoration === 'cyber';
  return (
    <group>
      {arena.platforms.map((p, i) => (
        <Island key={i} platform={p} theme={t} main={i === 0} glowEdges={glowEdges} />
      ))}
      <Decoration arena={arena} effectsScale={effectsScale} />
    </group>
  );
}
