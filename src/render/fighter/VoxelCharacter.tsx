/**
 * VoxelCharacter — a stylized voxel human built from simple boxes.
 *
 * The style is intentionally "modern voxel": chunky but proportioned bodies,
 * expressive faces (eyes, brows), hair, and per-fighter accessories (glasses,
 * goatee). Everything is a small number of boxes so drawing eight of them at
 * once stays cheap. Animated groups are exposed via refs so the parent can pose
 * the model each frame without React re-renders.
 */
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { FighterAppearance } from '@/core/types';

export interface CharacterRefs {
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  /** Materials that should flash white when hit / glow during ultimate. */
  materials: THREE.MeshStandardMaterial[];
}

interface Props {
  appearance: FighterAppearance;
}

/** Small helper for a solid voxel box mesh. */
function Box({
  args,
  position,
  color,
  matRef,
  roughness = 0.6,
  metalness = 0.05,
}: {
  args: [number, number, number];
  position: [number, number, number];
  color: string;
  matRef?: (m: THREE.MeshStandardMaterial | null) => void;
  roughness?: number;
  metalness?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial
        ref={(m) => matRef?.(m as THREE.MeshStandardMaterial | null)}
        color={color}
        roughness={roughness}
        metalness={metalness}
      />
    </mesh>
  );
}

export const VoxelCharacter = forwardRef<CharacterRefs, Props>(function VoxelCharacter(
  { appearance },
  ref,
) {
  const body = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);

  const collect = (m: THREE.MeshStandardMaterial | null): void => {
    if (m && !mats.current.includes(m)) mats.current.push(m);
  };

  useImperativeHandle(
    ref,
    () => ({
      body: body.current,
      head: head.current,
      armL: armL.current,
      armR: armR.current,
      legL: legL.current,
      legR: legR.current,
      materials: mats.current,
    }),
    [],
  );

  // Hair geometry varies with the style for a bit of silhouette variety.
  const hairPieces = useMemo(() => {
    const a = appearance;
    const pieces: { args: [number, number, number]; pos: [number, number, number] }[] = [
      { args: [0.62, 0.16, 0.62], pos: [0, 0.34, 0] },
    ];
    if (a.hairStyle === 'medium' || a.hairStyle === 'styled') {
      pieces.push({ args: [0.66, 0.12, 0.3], pos: [0, 0.22, -0.2] });
    }
    if (a.hairStyle === 'styled') {
      pieces.push({ args: [0.2, 0.22, 0.2], pos: [0, 0.42, 0.18] });
    }
    return pieces;
  }, [appearance]);

  return (
    <group>
      {/* Legs (pivot at hip, extend downward). */}
      <group ref={legL} position={[-0.16, 0.55, 0]}>
        <Box args={[0.26, 0.55, 0.28]} position={[0, -0.28, 0]} color={'#2a2a30'} matRef={collect} />
        <Box args={[0.28, 0.12, 0.34]} position={[0, -0.56, 0.03]} color={'#1a1a1e'} matRef={collect} />
      </group>
      <group ref={legR} position={[0.16, 0.55, 0]}>
        <Box args={[0.26, 0.55, 0.28]} position={[0, -0.28, 0]} color={'#2a2a30'} matRef={collect} />
        <Box args={[0.28, 0.12, 0.34]} position={[0, -0.56, 0.03]} color={'#1a1a1e'} matRef={collect} />
      </group>

      {/* Body root — the parent tilts/rotates this whole group. */}
      <group ref={body} position={[0, 0.55, 0]}>
        {/* Torso / shirt. */}
        <Box args={[0.6, 0.62, 0.36]} position={[0, 0.3, 0]} color={appearance.shirt} matRef={collect} />
        {/* Accent belt / collar. */}
        <Box args={[0.62, 0.08, 0.38]} position={[0, 0.02, 0]} color={appearance.accent} matRef={collect} />

        {/* Arms (pivot at shoulder). */}
        <group ref={armL} position={[-0.4, 0.55, 0]}>
          <Box args={[0.18, 0.5, 0.2]} position={[0, -0.24, 0]} color={appearance.shirt} matRef={collect} />
          <Box args={[0.19, 0.16, 0.21]} position={[0, -0.5, 0]} color={appearance.skin} matRef={collect} />
        </group>
        <group ref={armR} position={[0.4, 0.55, 0]}>
          <Box args={[0.18, 0.5, 0.2]} position={[0, -0.24, 0]} color={appearance.shirt} matRef={collect} />
          <Box args={[0.19, 0.16, 0.21]} position={[0, -0.5, 0]} color={appearance.skin} matRef={collect} />
        </group>

        {/* Head group. */}
        <group ref={head} position={[0, 0.78, 0]}>
          {/* Skull. */}
          <Box args={[0.56, 0.56, 0.52]} position={[0, 0, 0]} color={appearance.skin} matRef={collect} />
          {/* Hair. */}
          {hairPieces.map((h, i) => (
            <Box key={i} args={h.args} position={h.pos} color={appearance.hair} matRef={collect} />
          ))}
          {/* Eyes. */}
          <Box args={[0.1, 0.12, 0.05]} position={[-0.13, 0.02, 0.27]} color={'#ffffff'} matRef={collect} />
          <Box args={[0.1, 0.12, 0.05]} position={[0.13, 0.02, 0.27]} color={'#ffffff'} matRef={collect} />
          <Box args={[0.05, 0.06, 0.04]} position={[-0.13, 0.0, 0.29]} color={appearance.eyes} matRef={collect} />
          <Box args={[0.05, 0.06, 0.04]} position={[0.13, 0.0, 0.29]} color={appearance.eyes} matRef={collect} />
          {/* Brows for expression. */}
          <Box args={[0.14, 0.03, 0.04]} position={[-0.13, 0.13, 0.28]} color={appearance.hair} matRef={collect} />
          <Box args={[0.14, 0.03, 0.04]} position={[0.13, 0.13, 0.28]} color={appearance.hair} matRef={collect} />
          {/* Optional glasses. */}
          {appearance.glasses && (
            <>
              <Box args={[0.16, 0.14, 0.03]} position={[-0.13, 0.01, 0.3]} color={'#101014'} matRef={collect} />
              <Box args={[0.16, 0.14, 0.03]} position={[0.13, 0.01, 0.3]} color={'#101014'} matRef={collect} />
              <Box args={[0.1, 0.03, 0.03]} position={[0, 0.01, 0.3]} color={'#101014'} matRef={collect} />
            </>
          )}
          {/* Optional goatee. */}
          {appearance.goatee && (
            <Box args={[0.18, 0.12, 0.06]} position={[0, -0.28, 0.22]} color={appearance.hair} matRef={collect} />
          )}
        </group>
      </group>
    </group>
  );
});
