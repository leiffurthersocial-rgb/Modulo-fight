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
import { useRecords } from '@/state/recordsStore';
import { resolveBindings, useSettings } from '@/state/settingsStore';
import { audioManager } from '@/systems/audio/AudioManager';
import { KeyboardController } from '@/systems/input/KeyboardController';
import { emptyInput, type InputFrame } from '@/systems/input/InputState';
import { Simulation } from '@/systems/simulation/Simulation';
import { useDebug } from '@/state/debugStore';
import { GameScene } from '@/render/GameScene';
import { HUD } from './HUD';
import { Announcements } from './Announcements';
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
    duelOpponentId: s.duelOpponentId,
    practiceOpponentId: s.practiceOpponentId,
    practiceStocks: s.practiceStocks,
  }));
  const goto = useGame((s) => s.goto);
  const quality = useSettings((s) => s.quality);
  const cameraShake = useSettings((s) => s.cameraShake);
  const showControls = useSettings((s) => s.showControls);
  const batterySaver = useSettings((s) => s.batterySaver);
  const autoPauseOnBlur = useSettings((s) => s.autoPauseOnBlur);
  const hitMarkers = useSettings((s) => s.hitMarkers);
  const effectsAmount = useSettings((s) => s.effectsAmount);
  const keyOverrides = useSettings((s) => s.keyOverrides);
  const debugOpen = useDebug((s) => s.open);
  const setDebugOpen = useDebug((s) => s.setOpen);

  // Battery saver overrides quality/effects regardless of the Quality setting:
  // no shadows/bloom (low quality), zero ambient particles, no shockwaves or
  // motion streaks, and a reduced render resolution.
  const effectiveQuality = batterySaver ? 'low' : quality;
  const effectiveCameraShake = cameraShake && !batterySaver;
  const effectsScale = batterySaver
    ? 0
    : { low: 0.5, normal: 1, high: 1.5 }[effectsAmount];

  const [matchKey, setMatchKey] = useState(0);
  const [paused, setPaused] = useState(false);

  // Input plumbing shared with the simulation. Initial bindings only — later
  // rebinds are applied live by the effect below via keyboard.setBindings.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const keyboard = useMemo(() => new KeyboardController(resolveBindings(keyOverrides)), []);
  const frameRef = useRef<InputFrame>(emptyInput());
  const consumedRef = useRef(false);

  // Live-apply key rebinds without needing to restart the match.
  useEffect(() => {
    keyboard.setBindings(resolveBindings(keyOverrides));
  }, [keyboard, keyOverrides]);

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

  // Auto-pause when the tab loses focus or is hidden, so a match never keeps
  // running (and draining battery) unattended.
  useEffect(() => {
    if (!autoPauseOnBlur) return;
    const pauseIfRunning = (): void => {
      if (document.hidden && sim.status === 'running') {
        setPaused(true);
        sim.pause();
      }
    };
    document.addEventListener('visibilitychange', pauseIfRunning);
    window.addEventListener('blur', pauseIfRunning);
    return () => {
      document.removeEventListener('visibilitychange', pauseIfRunning);
      window.removeEventListener('blur', pauseIfRunning);
    };
  }, [autoPauseOnBlur, sim]);

  // Survive integrity: a run is "tainted" (no record) if the debug menu was
  // unlocked at any point during it. Reset per match, latched on unlock.
  const runTainted = useRef(false);
  useEffect(() => {
    runTainted.current = useDebug.getState().unlocked;
    const unsub = useDebug.subscribe((state) => {
      if (state.unlocked) runTainted.current = true;
    });
    return unsub;
  }, [sim]);

  const restart = useCallback(() => {
    setPaused(false);
    setMatchKey((k) => k + 1);
  }, []);

  const onFinished = useCallback(() => {
    if (sim.config.mode === 'survive') {
      const tainted = runTainted.current;
      const fighterId = selections.playerFighterId;
      const isRecord = tainted ? false : useRecords.getState().submit(fighterId, sim.score);
      useGame.getState().setSurviveResult({
        score: sim.score,
        wave: sim.wave,
        fighterId,
        tainted,
        isRecord,
      });
    }
    // Give the final KO a beat to land before showing results.
    window.setTimeout(() => goto('results'), 1100);
  }, [goto, sim, selections.playerFighterId]);

  return (
    <div className="app">
      <Canvas
        shadows={effectiveQuality !== 'low'}
        dpr={batterySaver ? 0.75 : effectiveQuality === 'high' ? [1, 2] : [1, 1.5]}
        gl={{ antialias: effectiveQuality === 'high', powerPreference: batterySaver ? 'low-power' : 'high-performance' }}
        camera={{ position: [0, 4, 24], fov: 42 }}
      >
        <GameScene
          key={matchKey}
          sim={sim}
          quality={effectiveQuality}
          cameraShake={effectiveCameraShake}
          hitMarkers={hitMarkers}
          effectsScale={effectsScale}
          beginFrame={beginFrame}
          endFrame={endFrame}
          onFinished={onFinished}
        />
      </Canvas>

      <HUD />
      <Announcements key={matchKey} sim={sim} />
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
