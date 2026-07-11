/**
 * FighterView — bridges a `FighterRuntime` to its 3D voxel model.
 *
 * All per-frame work happens in `useFrame` by mutating Three.js objects
 * directly (position, rotation, limb poses, material emissive). No React state
 * changes during a match, so this scales to eight fighters at 60 FPS.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FIGHTER_HALF_HEIGHT } from '@/core/constants';
import { damp } from '@/core/math';
import type { FighterRuntime } from '@/systems/simulation/FighterRuntime';
import { computePose } from './poses';
import { VoxelCharacter, type CharacterRefs } from './VoxelCharacter';

interface Props {
  runtime: FighterRuntime;
}

export function FighterView({ runtime }: Props) {
  const root = useRef<THREE.Group>(null!);
  const charRef = useRef<CharacterRefs>(null!);
  const accent = useMemo(() => new THREE.Color(runtime.config.appearance.accent), [runtime]);
  const flashColor = useMemo(() => new THREE.Color('#ffffff'), []);
  const smoothed = useRef({ x: runtime.pos.x, y: runtime.pos.y, facing: 1 });

  useFrame((_, dt) => {
    const g = root.current;
    const c = charRef.current;
    if (!g || !c) return;

    // --- Position (smoothed a touch to hide fixed-step aliasing) -----------
    const s = smoothed.current;
    s.x = damp(s.x, runtime.pos.x, 30, dt);
    s.y = damp(s.y, runtime.pos.y, 30, dt);
    g.position.set(s.x, s.y - FIGHTER_HALF_HEIGHT, 0);

    // --- Facing (rotate to profile, smooth the flip) -----------------------
    const targetFacing = runtime.facing * (Math.PI / 2);
    s.facing = damp(s.facing, targetFacing, 18, dt);
    g.rotation.y = s.facing;

    // Hide during respawn wait; blink during invulnerability.
    if (runtime.respawnTimer > 0 || runtime.eliminated) {
      g.visible = false;
    } else if (runtime.invuln > 0) {
      g.visible = Math.floor(performance.now() / 80) % 2 === 0;
    } else {
      g.visible = true;
    }

    // --- Pose --------------------------------------------------------------
    const attackProgress = runtime.attack
      ? runtime.attack.elapsed /
        (runtime.attack.data.startup + runtime.attack.data.active + runtime.attack.data.recovery)
      : 0;
    const speed = Math.abs(runtime.vel.x);
    const pose = computePose(runtime.state, runtime.stateTime, speed, attackProgress);

    c.body.position.y = 0.55 + pose.bodyY;
    c.body.rotation.z = pose.bodyTilt * -runtime.facing;
    c.body.rotation.y = pose.bodyRotY;
    c.body.scale.setScalar(1);
    c.body.scale.y = pose.squash;
    c.head.rotation.z = pose.headTilt;
    c.armL.rotation.x = pose.armLeft;
    c.armR.rotation.x = pose.armRight;
    c.legL.rotation.x = pose.legLeft;
    c.legR.rotation.x = pose.legRight;

    // --- Material emissive: hit flash + ultimate glow ----------------------
    const glow = runtime.ultCharge >= 1 ? 0.4 + Math.sin(performance.now() / 120) * 0.2 : 0;
    for (const m of c.materials) {
      if (runtime.hitFlash > 0) {
        m.emissive.copy(flashColor);
        m.emissiveIntensity = runtime.hitFlash * 4;
      } else if (glow > 0) {
        m.emissive.copy(accent);
        m.emissiveIntensity = glow;
      } else if (m.emissiveIntensity !== 0) {
        m.emissiveIntensity = 0;
      }
    }
  });

  return (
    <group ref={root}>
      <VoxelCharacter ref={charRef} appearance={runtime.config.appearance} />
      {/* Soft ground shadow blob keeps fighters readable against the arena. */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}
