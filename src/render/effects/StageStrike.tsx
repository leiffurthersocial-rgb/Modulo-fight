/**
 * StageStrike — overlays showing the real hit area of stage-wide attacks.
 *
 * Every normal attack advertises its hitbox with the attacker's swing arc, so
 * you can see exactly where it reaches. Two ultimates don't work that way: they
 * ignore the melee capsule and strike an entire *region* of the stage —
 * Leonidas's Earthquake hits every grounded fighter anywhere, Emir's Skyfall
 * hits every airborne one. Their swing arc is therefore a lie about their range.
 *
 * This component draws the region instead: the whole ground lights up for a
 * quake, the whole airspace for a sky-hunt. It ramps up during startup (the
 * "get off / stay on the floor" warning) and flashes hard on the active frames,
 * both tinted in the attacker's accent so it's obvious whose move it is.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { attackHitboxActive } from '@/systems/combat/CombatSystem';
import type { Simulation } from '@/systems/simulation/Simulation';

interface Props {
  sim: Simulation;
}

/** What the overlay should look like this frame. */
interface Telegraph {
  color: THREE.Color;
  /** True while the move is still winding up. */
  winding: boolean;
  /** 0→1 through the current phase (startup, or the active window). */
  phase: number;
}

export function StageStrike({ sim }: Props) {
  const arena = sim.config.arena;
  const groundRefs = useRef<THREE.Mesh[]>([]);
  const groundMats = useRef<THREE.MeshBasicMaterial[]>([]);
  const sky = useRef<THREE.Mesh>(null!);
  const skyMat = useRef<THREE.MeshBasicMaterial>(null!);

  // Accent colour per fighter id, so the overlay names its owner at a glance.
  const accents = useMemo(() => {
    const m = new Map<string, THREE.Color>();
    for (const f of sim.fighters) {
      m.set(f.config.id, new THREE.Color(f.config.appearance.accent));
    }
    return m;
  }, [sim]);

  // The airspace band: as wide as the blast zone, reaching from just above the
  // main platform up to the ceiling — i.e. everywhere "airborne" means.
  const skyBand = useMemo(() => {
    const main = arena.platforms[0];
    const top = main.y + main.height / 2;
    const width = arena.blastZone.right - arena.blastZone.left;
    const height = arena.blastZone.top - top;
    return {
      width,
      height,
      centre: [
        (arena.blastZone.left + arena.blastZone.right) / 2,
        top + height / 2,
      ] as const,
    };
  }, [arena]);

  useFrame(() => {
    // Find any live stage-wide ultimate. Only one of each kind can matter at a
    // time, and the roster has exactly one owner of each.
    let quake: Telegraph | null = null;
    let skyhunt: Telegraph | null = null;

    for (const f of sim.fighters) {
      const atk = f.attack;
      if (!atk || atk.data.kind !== 'ultimate') continue;
      if (!atk.data.quake && !atk.data.skyhunt) continue;
      const winding = atk.elapsed < atk.data.startup;
      if (!winding && !attackHitboxActive(atk)) continue;
      const t: Telegraph = {
        color: accents.get(f.config.id) ?? new THREE.Color('#ffffff'),
        winding,
        phase: winding
          ? atk.elapsed / Math.max(atk.data.startup, 0.001)
          : (atk.elapsed - atk.data.startup) / Math.max(atk.data.active, 0.001),
      };
      if (atk.data.quake) quake = t;
      else skyhunt = t;
    }

    // Warning swells toward the strike; the strike itself flashes and fades.
    const opacityFor = (t: Telegraph, warn: number, hit: number): number =>
      t.winding ? warn * t.phase : hit * (1 - t.phase);

    for (let i = 0; i < groundRefs.current.length; i++) {
      const mesh = groundRefs.current[i];
      const mat = groundMats.current[i];
      if (!mesh || !mat) continue;
      if (quake) {
        mesh.visible = true;
        mat.color.copy(quake.color);
        mat.opacity = opacityFor(quake, 0.4, 0.75);
      } else {
        mesh.visible = false;
      }
    }

    if (sky.current && skyMat.current) {
      if (skyhunt) {
        sky.current.visible = true;
        skyMat.current.color.copy(skyhunt.color);
        // Kept fainter than the ground overlay: it covers far more screen area,
        // and the fighters have to stay readable through it.
        skyMat.current.opacity = opacityFor(skyhunt, 0.16, 0.3);
      } else {
        sky.current.visible = false;
      }
    }
  });

  return (
    <>
      {/* One glowing sheet per platform surface — the quake's true hit area. */}
      {arena.platforms.map((p, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) {
              groundRefs.current[i] = m;
              groundMats.current[i] = m.material as THREE.MeshBasicMaterial;
            }
          }}
          visible={false}
          position={[p.x, p.y + p.height / 2 + 0.04, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[p.width, 3.2]} />
          <meshBasicMaterial
            color="#ff7a3c"
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* The airspace above the stage — the sky-hunt's true hit area. */}
      <mesh
        ref={sky}
        visible={false}
        position={[skyBand.centre[0], skyBand.centre[1], -0.4]}
      >
        <planeGeometry args={[skyBand.width, skyBand.height]} />
        <meshBasicMaterial
          ref={skyMat}
          color="#ff4fc3"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}
