/**
 * DebugOverlay — in-world visualisation of hitboxes and stage bounds.
 *
 * Reads the debug flags and the live simulation each frame and draws:
 *  - active attack hitboxes (red when live, yellow during startup),
 *  - platform collision rectangles,
 *  - the blast-zone boundary.
 * Everything is drawn with cheap wireframe/line helpers and is completely
 * skipped when the corresponding flags are off.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { debug } from '@/core/debug';
import { effectiveReach } from '@/systems/simulation/FighterRuntime';
import { attackHitboxActive } from '@/systems/combat/CombatSystem';
import type { Simulation } from '@/systems/simulation/Simulation';

const MAX_HITBOXES = 8;

export function DebugOverlay({ sim }: { sim: Simulation }) {
  const hitboxGroup = useRef<THREE.Group>(null!);

  // Static bounds geometry (platforms + blast zone) computed once per arena.
  const bounds = useMemo(() => {
    const arena = sim.config.arena;
    const platforms = arena.platforms.map((p) => ({
      pos: [p.x, p.y, 0] as [number, number, number],
      size: [p.width, p.height, 4.05] as [number, number, number],
    }));
    const b = arena.blastZone;
    const w = b.right - b.left;
    const h = b.top - b.bottom;
    return {
      platforms,
      blast: {
        pos: [(b.left + b.right) / 2, (b.top + b.bottom) / 2, 0] as [number, number, number],
        size: [w, h, 0.1] as [number, number, number],
      },
    };
  }, [sim]);

  useFrame(() => {
    const g = hitboxGroup.current;
    if (!g) return;
    let i = 0;
    if (debug.showHitboxes) {
      for (const f of sim.fighters) {
        if (i >= MAX_HITBOXES) break;
        const child = g.children[i] as THREE.Mesh;
        if (f.attack) {
          const reach = effectiveReach(f, f.attack.data);
          child.visible = true;
          child.position.set(
            f.pos.x + f.facing * reach,
            f.pos.y + f.attack.data.yOffset,
            0.5,
          );
          const r = f.attack.data.radius;
          child.scale.setScalar(r);
          const mat = child.material as THREE.MeshBasicMaterial;
          mat.color.set(attackHitboxActive(f.attack) ? '#ff2d55' : '#ffd54a');
          i++;
        }
      }
    }
    // Hide unused hitbox slots.
    for (; i < g.children.length; i++) g.children[i].visible = false;
  });

  return (
    <group>
      {debug.showBounds && (
        <group>
          {bounds.platforms.map((p, i) => (
            <mesh key={i} position={p.pos}>
              <boxGeometry args={p.size} />
              <meshBasicMaterial color="#22e6ff" wireframe transparent opacity={0.6} />
            </mesh>
          ))}
          <mesh position={bounds.blast.pos}>
            <boxGeometry args={bounds.blast.size} />
            <meshBasicMaterial color="#ff2d55" wireframe transparent opacity={0.4} />
          </mesh>
        </group>
      )}

      <group ref={hitboxGroup}>
        {Array.from({ length: MAX_HITBOXES }).map((_, i) => (
          <mesh key={i} visible={false}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshBasicMaterial color="#ff2d55" wireframe transparent opacity={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
