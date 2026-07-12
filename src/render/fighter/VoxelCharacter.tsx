/**
 * VoxelCharacter — a stylized voxel human built from simple boxes.
 *
 * The style is intentionally "modern voxel": chunky but proportioned bodies,
 * expressive faces (eyes with pupils, brows, nose, mouth), varied hair, and
 * per-fighter accessories (glasses, goatee, headband, scarf). Body *build*
 * (lean / normal / heavy) scales the silhouette so a tank reads as broad and a
 * speedster as slight — giving each fighter a recognisable shape at a glance.
 *
 * Everything is a small number of boxes so drawing eight at once stays cheap.
 * Animated groups are exposed via refs so the parent can pose the model each
 * frame without React re-renders.
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

interface HairPiece {
  args: [number, number, number];
  pos: [number, number, number];
}

/** Build the hair box set for a given style. */
function hairFor(style: FighterAppearance['hairStyle']): HairPiece[] {
  const cap: HairPiece = { args: [0.62, 0.16, 0.62], pos: [0, 0.34, 0] };
  switch (style) {
    case 'bald':
      return [];
    case 'buzz':
      return [{ args: [0.6, 0.09, 0.6], pos: [0, 0.31, 0] }];
    case 'short':
    case 'goatee':
      return [cap];
    case 'medium':
      return [cap, { args: [0.66, 0.14, 0.32], pos: [0, 0.2, -0.2] }];
    case 'styled':
      return [
        cap,
        { args: [0.66, 0.12, 0.3], pos: [0, 0.22, -0.2] },
        { args: [0.22, 0.24, 0.24], pos: [0.12, 0.42, 0.16] },
      ];
    case 'spiky':
      return [
        { args: [0.6, 0.12, 0.6], pos: [0, 0.32, 0] },
        { args: [0.12, 0.24, 0.12], pos: [-0.16, 0.46, 0.05] },
        { args: [0.12, 0.28, 0.12], pos: [0, 0.48, -0.05] },
        { args: [0.12, 0.24, 0.12], pos: [0.16, 0.46, 0.05] },
        { args: [0.12, 0.2, 0.12], pos: [0, 0.45, 0.18] },
      ];
    case 'mohawk':
      return [{ args: [0.16, 0.34, 0.62], pos: [0, 0.42, 0] }];
    case 'long':
      return [cap, { args: [0.64, 0.56, 0.22], pos: [0, -0.02, -0.28] }];
    case 'ponytail':
      return [
        cap,
        { args: [0.6, 0.12, 0.28], pos: [0, 0.24, -0.18] },
        { args: [0.18, 0.44, 0.18], pos: [0, 0.06, -0.36] },
      ];
    default:
      return [cap];
  }
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

  const hairPieces = useMemo(() => hairFor(appearance.hairStyle), [appearance.hairStyle]);

  const pants = appearance.pants ?? '#2a2a30';
  const shoes = appearance.shoes ?? '#191a1e';
  // Build scales the silhouette's bulk: heavies read broad, speedsters slight.
  const bulk =
    appearance.build === 'heavy' ? 1.16 : appearance.build === 'lean' ? 0.9 : 1;
  // A slightly darker skin tone for mouth/nose shading, derived from skin.
  const shade = useMemo(() => {
    const c = new THREE.Color(appearance.skin);
    c.multiplyScalar(0.72);
    return `#${c.getHexString()}`;
  }, [appearance.skin]);

  return (
    <group scale={[bulk, 1, bulk]}>
      {/* Legs (pivot at hip, extend downward). */}
      <group ref={legL} position={[-0.16, 0.55, 0]}>
        <Box args={[0.26, 0.55, 0.28]} position={[0, -0.28, 0]} color={pants} matRef={collect} />
        <Box args={[0.29, 0.14, 0.36]} position={[0, -0.57, 0.04]} color={shoes} matRef={collect} />
      </group>
      <group ref={legR} position={[0.16, 0.55, 0]}>
        <Box args={[0.26, 0.55, 0.28]} position={[0, -0.28, 0]} color={pants} matRef={collect} />
        <Box args={[0.29, 0.14, 0.36]} position={[0, -0.57, 0.04]} color={shoes} matRef={collect} />
      </group>

      {/* Body root — the parent tilts/rotates this whole group. */}
      <group ref={body} position={[0, 0.55, 0]}>
        {/* Torso / shirt. */}
        <Box args={[0.6, 0.62, 0.36]} position={[0, 0.3, 0]} color={appearance.shirt} matRef={collect} />
        {/* Accent belt / collar. */}
        <Box args={[0.62, 0.08, 0.38]} position={[0, 0.02, 0]} color={appearance.accent} matRef={collect} />
        {/* Chest accent stripe for a bit of costume detail. */}
        <Box args={[0.16, 0.5, 0.02]} position={[0, 0.32, 0.19]} color={appearance.accent} matRef={collect} />

        {/* Neck. */}
        <Box args={[0.22, 0.16, 0.22]} position={[0, 0.66, 0]} color={appearance.skin} matRef={collect} />
        {/* Optional scarf around the neck. */}
        {appearance.scarf && (
          <Box args={[0.46, 0.16, 0.42]} position={[0, 0.62, 0.02]} color={appearance.scarf} matRef={collect} />
        )}

        {/* Arms (pivot at shoulder). */}
        <group ref={armL} position={[-0.4, 0.55, 0]}>
          <Box args={[0.18, 0.46, 0.2]} position={[0, -0.22, 0]} color={appearance.shirt} matRef={collect} />
          <Box args={[0.18, 0.16, 0.2]} position={[0, -0.45, 0]} color={appearance.skin} matRef={collect} />
          {/* Fist + accent wristband. */}
          <Box args={[0.2, 0.06, 0.22]} position={[0, -0.55, 0]} color={appearance.accent} matRef={collect} />
          <Box args={[0.22, 0.2, 0.24]} position={[0, -0.68, 0.01]} color={appearance.skin} matRef={collect} />
        </group>
        <group ref={armR} position={[0.4, 0.55, 0]}>
          <Box args={[0.18, 0.46, 0.2]} position={[0, -0.22, 0]} color={appearance.shirt} matRef={collect} />
          <Box args={[0.18, 0.16, 0.2]} position={[0, -0.45, 0]} color={appearance.skin} matRef={collect} />
          <Box args={[0.2, 0.06, 0.22]} position={[0, -0.55, 0]} color={appearance.accent} matRef={collect} />
          <Box args={[0.22, 0.2, 0.24]} position={[0, -0.68, 0.01]} color={appearance.skin} matRef={collect} />
        </group>

        {/* Head group. */}
        <group ref={head} position={[0, 0.86, 0]}>
          {/* Skull. */}
          <Box args={[0.56, 0.56, 0.52]} position={[0, 0, 0]} color={appearance.skin} matRef={collect} />
          {/* Ears. */}
          <Box args={[0.06, 0.14, 0.14]} position={[-0.29, -0.02, 0]} color={appearance.skin} matRef={collect} />
          <Box args={[0.06, 0.14, 0.14]} position={[0.29, -0.02, 0]} color={appearance.skin} matRef={collect} />
          {/* Hair. */}
          {hairPieces.map((h, i) => (
            <Box key={i} args={h.args} position={h.pos} color={appearance.hair} matRef={collect} />
          ))}
          {/* Optional headband across the forehead. */}
          {appearance.headband && (
            <Box args={[0.6, 0.1, 0.56]} position={[0, 0.18, 0.01]} color={appearance.headband} matRef={collect} />
          )}
          {/* Eyes (white sclera + coloured pupil). */}
          <Box args={[0.11, 0.13, 0.05]} position={[-0.13, 0.02, 0.27]} color={'#ffffff'} matRef={collect} />
          <Box args={[0.11, 0.13, 0.05]} position={[0.13, 0.02, 0.27]} color={'#ffffff'} matRef={collect} />
          <Box args={[0.055, 0.07, 0.04]} position={[-0.13, 0.0, 0.29]} color={appearance.eyes} matRef={collect} />
          <Box args={[0.055, 0.07, 0.04]} position={[0.13, 0.0, 0.29]} color={appearance.eyes} matRef={collect} />
          {/* Brows for expression. */}
          <Box args={[0.15, 0.03, 0.04]} position={[-0.13, 0.14, 0.28]} color={appearance.hair} matRef={collect} />
          <Box args={[0.15, 0.03, 0.04]} position={[0.13, 0.14, 0.28]} color={appearance.hair} matRef={collect} />
          {/* Nose + mouth. */}
          <Box args={[0.09, 0.11, 0.09]} position={[0, -0.09, 0.28]} color={appearance.skin} matRef={collect} />
          <Box args={[0.18, 0.04, 0.03]} position={[0, -0.22, 0.27]} color={shade} matRef={collect} />
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
            <Box args={[0.18, 0.14, 0.06]} position={[0, -0.29, 0.22]} color={appearance.hair} matRef={collect} />
          )}
        </group>
      </group>
    </group>
  );
});
