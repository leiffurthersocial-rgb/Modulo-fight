/**
 * FighterView — bridges a `FighterRuntime` to its 3D voxel model.
 *
 * All per-frame work happens in `useFrame` by mutating Three.js objects
 * directly (position, rotation, limb poses, material emissive). No React state
 * changes during a match, so this scales to eight fighters at 60 FPS.
 *
 * The model itself sits in a facing-rotated inner group; camera-facing effects
 * (a projected contact shadow and a speed streak) live on the outer group so
 * they always read correctly regardless of which way the fighter faces.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FIGHTER_HALF_HEIGHT } from '@/core/constants';
import { clamp, damp } from '@/core/math';
import type { FighterRuntime } from '@/systems/simulation/FighterRuntime';
import { computePose, deriveAttackStyle, type AttackStyle } from './poses';
import { VoxelCharacter, type CharacterRefs } from './VoxelCharacter';

interface Props {
  runtime: FighterRuntime;
  /** World Y of the arena floor, used to project the contact shadow. */
  groundY?: number;
}

export function FighterView({ runtime, groundY = 0.6 }: Props) {
  const root = useRef<THREE.Group>(null!);
  const model = useRef<THREE.Group>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  const shadowMat = useRef<THREE.MeshBasicMaterial>(null!);
  const trail = useRef<THREE.Mesh>(null!);
  const trailMat = useRef<THREE.MeshBasicMaterial>(null!);
  const shield = useRef<THREE.Mesh>(null!);
  const shieldMat = useRef<THREE.MeshBasicMaterial>(null!);
  const charRef = useRef<CharacterRefs>(null!);
  const accent = useMemo(() => new THREE.Color(runtime.config.appearance.accent), [runtime]);
  // Precompute an animation style per attack slot so each move looks distinct.
  const attackStyles = useMemo<Record<string, AttackStyle>>(() => {
    const a = runtime.config.attacks;
    return {
      light: deriveAttackStyle(a.light),
      heavy: deriveAttackStyle(a.heavy),
      special: deriveAttackStyle(a.special),
      ultimate: deriveAttackStyle(a.ultimate),
    };
  }, [runtime]);
  const flashColor = useMemo(() => new THREE.Color('#ffffff'), []);
  const smoothed = useRef({ x: runtime.pos.x, y: runtime.pos.y, facing: 1, trail: 0 });

  useFrame((_, dt) => {
    const g = root.current;
    const c = charRef.current;
    const m = model.current;
    if (!g || !c || !m) return;

    // --- Position (smoothed a touch to hide fixed-step aliasing) -----------
    const s = smoothed.current;
    s.x = damp(s.x, runtime.pos.x, 30, dt);
    s.y = damp(s.y, runtime.pos.y, 30, dt);
    const footY = s.y - FIGHTER_HALF_HEIGHT;
    g.position.set(s.x, footY, 0);

    // --- Facing (rotate the model to profile, smooth the flip) -------------
    const targetFacing = runtime.facing * (Math.PI / 2);
    s.facing = damp(s.facing, targetFacing, 18, dt);
    m.rotation.y = s.facing;

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
    const style = runtime.attack ? attackStyles[runtime.attack.data.kind] : 'punch';
    const pose = computePose(
      runtime.state,
      runtime.stateTime,
      speed,
      attackProgress,
      style,
      runtime.facing,
    );

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
    for (const mm of c.materials) {
      if (runtime.hitFlash > 0) {
        mm.emissive.copy(flashColor);
        mm.emissiveIntensity = runtime.hitFlash * 4;
      } else if (glow > 0) {
        mm.emissive.copy(accent);
        mm.emissiveIntensity = glow;
      } else if (mm.emissiveIntensity !== 0) {
        mm.emissiveIntensity = 0;
      }
    }

    // --- Projected contact shadow ------------------------------------------
    // Pin the blob to the floor and shrink/fade it with height so an airborne
    // fighter reads as genuinely off the ground.
    if (shadow.current && shadowMat.current) {
      const height = Math.max(0, footY - groundY);
      const localY = groundY - footY + 0.02; // ground plane in the group's frame
      shadow.current.position.y = localY;
      const k = clamp(1 - height / 9, 0.12, 1);
      shadow.current.scale.setScalar(k);
      shadowMat.current.opacity = 0.26 * k;
    }

    // --- Speed streak ------------------------------------------------------
    // A camera-facing accent smear that grows with horizontal speed / dashing.
    if (trail.current && trailMat.current) {
      const dashing = runtime.state === 'dash' || runtime.state === 'dodge';
      const norm = clamp((speed - 6.5) / 16, 0, 1) + (dashing ? 0.5 : 0);
      s.trail = damp(s.trail, Math.min(norm, 1), 20, dt);
      if (s.trail > 0.02) {
        trail.current.visible = true;
        const dir = runtime.vel.x >= 0 ? 1 : -1;
        trail.current.position.set(-dir * (0.4 + s.trail * 0.7), 0.95, -0.05);
        trail.current.scale.set(0.6 + s.trail * 2.4, 1.5, 1);
        trailMat.current.opacity = s.trail * 0.35;
      } else {
        trail.current.visible = false;
      }
    }

    // --- Shield bubble -----------------------------------------------------
    // A translucent accent dome that shrinks as the shield depletes, making
    // the defensive state (and its remaining strength) instantly readable.
    if (shield.current && shieldMat.current) {
      if (runtime.shielding && runtime.shield > 0.02) {
        shield.current.visible = true;
        const sc = 0.7 + runtime.shield * 0.75;
        shield.current.scale.setScalar(sc);
        shield.current.position.y = 0.95;
        shieldMat.current.opacity = 0.16 + runtime.shield * 0.22;
      } else {
        shield.current.visible = false;
      }
    }
  });

  return (
    <group ref={root}>
      <group ref={model}>
        <VoxelCharacter ref={charRef} appearance={runtime.config.appearance} />
      </group>
      {/* Soft projected ground shadow keeps fighters readable against the arena. */}
      <mesh ref={shadow} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 20]} />
        <meshBasicMaterial
          ref={shadowMat}
          color="#000000"
          transparent
          opacity={0.26}
          depthWrite={false}
        />
      </mesh>
      {/* Speed streak (hidden until moving fast). */}
      <mesh ref={trail} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={trailMat}
          color={runtime.config.appearance.accent}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Shield dome (hidden unless shielding). */}
      <mesh ref={shield} visible={false} position={[0, 0.95, 0]}>
        <sphereGeometry args={[1, 18, 18]} />
        <meshBasicMaterial
          ref={shieldMat}
          color={runtime.config.appearance.accent}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
