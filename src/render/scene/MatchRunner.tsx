/**
 * MatchRunner — the bridge between the render loop and the simulation.
 *
 * Each rendered frame it: samples input once, advances the fixed-step
 * simulation, drives the dynamic arena camera, applies impact camera-shake,
 * throttles a HUD snapshot into the store, and reports the match result when
 * the bout ends. It renders nothing itself.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getFighter } from '@/fighters/fighterData';
import { useGame } from '@/state/gameStore';
import {
  createCameraState,
  DEFAULT_CAMERA_TUNING,
  updateCamera,
} from '@/systems/camera/ArenaCamera';
import type { Simulation } from '@/systems/simulation/Simulation';

interface Props {
  sim: Simulation;
  /** Samples input and prepares the per-frame input snapshot. */
  beginFrame: () => void;
  endFrame: () => void;
  cameraShake: boolean;
  onFinished: () => void;
}

export function MatchRunner({ sim, beginFrame, endFrame, cameraShake, onFinished }: Props) {
  const { camera, size } = useThree();
  const cam = useMemo(createCameraState, []);
  const shake = useRef(0);
  const hudTimer = useRef(0);
  const fpsTimer = useRef({ acc: 0, frames: 0 });
  const finished = useRef(false);
  const setHudSnapshot = useGame((s) => s.setHudSnapshot);
  const setFps = useGame((s) => s.setFps);

  // Impact shake responds to knockouts and ultimates.
  useEffect(() => {
    const unsub = sim.events.subscribe((e) => {
      if (!cameraShake) return;
      if (e.type === 'knockout') shake.current = Math.min(shake.current + 0.9, 1.4);
      else if (e.type === 'ultimate') shake.current = Math.min(shake.current + 0.6, 1.2);
      else if (e.type === 'hit' && e.power > 12) shake.current = Math.min(shake.current + 0.25, 0.8);
    });
    return unsub;
  }, [sim, cameraShake]);

  useFrame((_, dt) => {
    // 1. Input + simulation.
    beginFrame();
    sim.advance(dt);
    endFrame();

    // 2. Camera framing over all living fighters.
    const points = sim.fighters
      .filter((f) => !f.eliminated && f.respawnTimer <= 0)
      .map((f) => ({ x: f.pos.x, y: f.pos.y }));
    const tuning = { ...DEFAULT_CAMERA_TUNING, aspect: size.width / Math.max(1, size.height) };
    updateCamera(cam, points, tuning, dt);

    // 3. Apply to the actual camera, with decaying shake.
    let sx = 0;
    let sy = 0;
    if (shake.current > 0.001) {
      sx = (Math.random() - 0.5) * shake.current;
      sy = (Math.random() - 0.5) * shake.current;
      shake.current *= Math.exp(-6 * dt);
    }
    camera.position.set(cam.focusX + sx, cam.focusY + sy, cam.distance);
    camera.lookAt(cam.focusX, cam.focusY, 0);

    // 4. Throttled HUD snapshot (~12 Hz keeps React idle during play).
    hudTimer.current += dt;
    if (hudTimer.current >= 0.08) {
      hudTimer.current = 0;
      setHudSnapshot({
        timeRemaining: sim.timeRemaining,
        fighters: sim.fighters.map((f) => ({
          index: f.index,
          configId: f.config.id,
          name: f.config.name,
          accent: f.config.appearance.accent,
          damage: f.damage,
          stocks: f.stocks,
          eliminated: f.eliminated,
          isPlayer: f.isPlayer,
          ultCharge: f.ultCharge,
          comboCount: f.comboCount,
        })),
      });
    }

    // 5. FPS counter.
    const fps = fpsTimer.current;
    fps.acc += dt;
    fps.frames += 1;
    if (fps.acc >= 0.5) {
      setFps(Math.round(fps.frames / fps.acc));
      fps.acc = 0;
      fps.frames = 0;
    }

    // 6. End-of-match handoff.
    if (sim.status === 'finished' && !finished.current) {
      finished.current = true;
      const placements = (sim.result?.placements ?? []).map((idx) => {
        const cfg = getFighter(sim.fighters[idx].config.id);
        return { index: idx, configId: cfg.id, name: cfg.name };
      });
      useGame.getState().setResults(placements);
      onFinished();
    }
  });

  // Configure the perspective camera once.
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 42;
      camera.near = 0.1;
      camera.far = 200;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  return null;
}
