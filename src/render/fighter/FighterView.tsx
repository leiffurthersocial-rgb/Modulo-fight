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
import { useSettings } from '@/state/settingsStore';
import { effectiveReach, type FighterRuntime } from '@/systems/simulation/FighterRuntime';
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
  const swing = useRef<THREE.Mesh>(null!);
  const swingMat = useRef<THREE.MeshBasicMaterial>(null!);
  const ultRing = useRef<THREE.Mesh>(null!);
  const ultRingMat = useRef<THREE.MeshBasicMaterial>(null!);
  const charRef = useRef<CharacterRefs>(null!);
  const accent = useMemo(() => new THREE.Color(runtime.config.appearance.accent), [runtime]);
  // Slash tint per attack slot: jabs read white-hot, committal moves read in the
  // fighter's accent, ultimates in blazing gold-tinted accent.
  const swingColors = useMemo(() => {
    const acc = new THREE.Color(runtime.config.appearance.accent);
    return {
      light: new THREE.Color('#ffffff'),
      heavy: acc.clone().lerp(new THREE.Color('#ffffff'), 0.35),
      special: acc.clone().lerp(new THREE.Color('#ffffff'), 0.15),
      ultimate: acc.clone().lerp(new THREE.Color('#ffd54a'), 0.55),
    } as const;
  }, [runtime]);
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

    // Airborne velocity lean: drifting fighters bank into their motion, which
    // makes jumps and launches read as momentum rather than sliding.
    const leanTarget = !runtime.grounded ? clamp(runtime.vel.x * -0.02, -0.3, 0.3) : 0;
    m.rotation.z = damp(m.rotation.z, leanTarget, 10, dt);

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
    c.body.rotation.x = pose.bodyRotX;
    c.body.rotation.y = pose.bodyRotY;
    c.body.scale.setScalar(1);
    c.body.scale.y = pose.squash;
    c.head.rotation.z = pose.headTilt;
    c.armL.rotation.x = pose.armLeft;
    c.armR.rotation.x = pose.armRight;
    c.legL.rotation.x = pose.legLeft;
    c.legR.rotation.x = pose.legRight;

    // --- Material emissive: hit flash > ultimate execution > charged glow --
    const ultActive = runtime.attack?.data.kind === 'ultimate';
    const glow = ultActive
      ? 1.1 + Math.sin(performance.now() / 60) * 0.35
      : runtime.ultCharge >= 1
        ? 0.4 + Math.sin(performance.now() / 120) * 0.2
        : 0;
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

    // --- Attack swing slash --------------------------------------------------
    // A crescent arc drawn at the hitbox during the active window (with a short
    // linger), so every strike — and its actual range — is visible, not implied.
    if (swing.current && swingMat.current) {
      const atk = runtime.attack;
      const linger = 0.07;
      if (atk && atk.elapsed >= atk.data.startup) {
        const p = clamp((atk.elapsed - atk.data.startup) / (atk.data.active + linger), 0, 1);
        if (p < 1) {
          swing.current.visible = true;
          const reach = effectiveReach(runtime, atk.data);
          const kind = atk.data.kind;
          const sc = (reach + atk.data.radius * 0.6) * (kind === 'ultimate' ? 1.25 : 1);
          swing.current.position.set(runtime.facing * 0.25, atk.data.yOffset + FIGHTER_HALF_HEIGHT, 0.35);
          // Mirroring via scale.x flips the arc with facing; rotation sweeps it.
          swing.current.scale.set(runtime.facing * sc, sc, 1);
          swing.current.rotation.z = (0.5 - p) * 1.3;
          swingMat.current.color.copy(swingColors[kind]);
          swingMat.current.opacity =
            Math.sin(Math.min(p, 1) * Math.PI) * (kind === 'ultimate' ? 0.95 : kind === 'light' ? 0.5 : 0.75);
        } else {
          swing.current.visible = false;
        }
      } else {
        swing.current.visible = false;
      }
    }

    // --- Ultimate telegraph + shock ring -------------------------------------
    // During startup a ring converges inward (clear "it's coming" warning);
    // during the strike it blasts outward. Reads at a glance from any zoom.
    if (ultRing.current && ultRingMat.current) {
      const atk = runtime.attack;
      if (atk && atk.data.kind === 'ultimate') {
        const total = atk.data.startup + atk.data.active + atk.data.recovery * 0.5;
        const winding = atk.elapsed < atk.data.startup;
        const wp = winding
          ? 1 - atk.elapsed / atk.data.startup // 1 → 0 converging
          : clamp((atk.elapsed - atk.data.startup) / (total - atk.data.startup), 0, 1);
        ultRing.current.visible = true;
        const sc = winding ? 0.9 + wp * 2.4 : 1 + wp * 3.6;
        ultRing.current.scale.set(sc, sc, 1);
        ultRing.current.position.y = 0.06;
        ultRingMat.current.color.copy(swingColors.ultimate);
        ultRingMat.current.opacity = winding ? 0.75 : (1 - wp) * 0.8;
      } else {
        ultRing.current.visible = false;
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
      const s2 = useSettings.getState();
      const streaksOn = s2.speedStreaks && !s2.batterySaver;
      const dashing = runtime.state === 'dash' || runtime.state === 'dodge';
      const norm = streaksOn ? clamp((speed - 6.5) / 16, 0, 1) + (dashing ? 0.5 : 0) : 0;
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
      {/* Attack swing slash — a crescent arc at the live hitbox. */}
      <mesh ref={swing} visible={false}>
        <ringGeometry args={[0.55, 1, 24, 1, -0.95, 1.9]} />
        <meshBasicMaterial
          ref={swingMat}
          color="#ffffff"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Ultimate telegraph / shock ring on the ground. */}
      <mesh ref={ultRing} visible={false} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 1, 40]} />
        <meshBasicMaterial
          ref={ultRingMat}
          color="#ffd54a"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
