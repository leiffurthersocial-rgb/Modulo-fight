/**
 * GameScreen — hosts a live match.
 *
 * Owns the `Simulation` instance, the keyboard controller and the per-frame
 * input plumbing, then renders the R3F canvas (via `GameScene`) plus the DOM
 * overlays (HUD, pause menu). Input edges are sampled exactly once per rendered
 * frame and consumed once by the simulation, so actions never double-fire even
 * when the fixed-step loop runs multiple sub-steps to catch up.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { getFighter } from '@/fighters/fighterData';
import { buildMatchConfig } from '@/game/matchSetup';
import { useGame } from '@/state/gameStore';
import { useSettings } from '@/state/settingsStore';
import { audioManager } from '@/systems/audio/AudioManager';
import { DEFAULT_BINDINGS, KeyboardController } from '@/systems/input/KeyboardController';
import { emptyInput, type InputFrame } from '@/systems/input/InputState';
import { Simulation } from '@/systems/simulation/Simulation';
import { useDebug } from '@/state/debugStore';
import { GameScene } from '@/render/GameScene';
import { HUD } from './HUD';
import { PauseMenu } from './PauseMenu';
import { ControlsLegend } from './Controls';
import { DebugMenu } from './DebugMenu';
import { DebugInfo } from './DebugInfo';

export function GameScreen() {
  const selections = useGame((s) => ({
    mode: s.mode,
    arenaId: s.arenaId,
    playerFighterId: s.playerFighterId,
    botFighterIds: s.botFighterIds,
    difficulty: s.difficulty,
    stocks: s.stocks,
    timeLimit: s.timeLimit,
    practiceOpponentId: s.practiceOpponentId,
  }));
  const goto = useGame((s) => s.goto);
  const quality = useSettings((s) => s.quality);
  const cameraShake = useSettings((s) => s.cameraShake);
  const showControls = useSettings((s) => s.showControls);
  const debugOpen = useDebug((s) => s.open);
  const setDebugOpen = useDebug((s) => s.setOpen);

  const [matchKey, setMatchKey] = useState(0);
  const [paused, setPaused] = useState(false);

  // Input plumbing shared with the simulation.
  const keyboard = useMemo(() => new KeyboardController(DEFAULT_BINDINGS), []);
  const frameRef = useRef<InputFrame>(emptyInput());
  const consumedRef = useRef(false);

  const playerInput = useCallback((): InputFrame => {
    if (consumedRef.current) {
      // Subsequent sub-steps this frame keep held state but drop edge presses.
      const f = frameRef.current;
      return {
        ...f,
        jump: false,
        light: false,
        heavy: false,
        special: false,
        ultimate: false,
        dash: false,
        dodge: false,
      };
    }
    consumedRef.current = true;
    return frameRef.current;
  }, []);

  // Build a fresh simulation for each match / restart.
  const sim = useMemo(
    () => new Simulation(buildMatchConfig(selections), getFighter, playerInput),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchKey],
  );

  const beginFrame = useCallback(() => {
    frameRef.current = keyboard.sample();
    consumedRef.current = false;
  }, [keyboard]);

  const endFrame = useCallback(() => {
    keyboard.endFrame();
  }, [keyboard]);

  // Attach keyboard + audio for the lifetime of the match.
  useEffect(() => {
    keyboard.attach();
    audioManager.bind(sim.events);
    audioManager.startMusic();
    return () => {
      keyboard.detach();
      audioManager.stopMusic();
      audioManager.unbind();
    };
  }, [keyboard, sim]);

  // Pause toggling via Escape.
  useEffect(() => {
    keyboard.setPauseHandler(() => {
      setPaused((p) => {
        const next = !p;
        if (next) sim.pause();
        else sim.resume();
        audioManager.play('select');
        return next;
      });
    });
  }, [keyboard, sim]);

  // Opening the debug menu resumes the match so live tuning is visible.
  useEffect(() => {
    if (debugOpen) {
      setPaused(false);
      sim.resume();
    }
  }, [debugOpen, sim]);

  const restart = useCallback(() => {
    setPaused(false);
    setMatchKey((k) => k + 1);
  }, []);

  const onFinished = useCallback(() => {
    // Give the final KO a beat to land before showing results.
    window.setTimeout(() => goto('results'), 1100);
  }, [goto]);

  return (
    <div className="app">
      <Canvas
        shadows={quality !== 'low'}
        dpr={quality === 'high' ? [1, 2] : [1, 1.5]}
        gl={{ antialias: quality === 'high', powerPreference: 'high-performance' }}
        camera={{ position: [0, 4, 24], fov: 42 }}
      >
        <GameScene
          key={matchKey}
          sim={sim}
          quality={quality}
          cameraShake={cameraShake}
          beginFrame={beginFrame}
          endFrame={endFrame}
          onFinished={onFinished}
        />
      </Canvas>

      <HUD />
      <DebugInfo />

      {showControls && !paused && !debugOpen && <ControlsLegend />}

      {paused && !debugOpen && (
        <PauseMenu
          onResume={() => {
            setPaused(false);
            sim.resume();
          }}
          onRestart={restart}
          onQuit={() => goto('mainMenu')}
        />
      )}

      {/* Debug menu runs over a *live* match so tuning is visible immediately. */}
      {debugOpen && <DebugMenu sim={sim} onClose={() => setDebugOpen(false)} />}
    </div>
  );
}
