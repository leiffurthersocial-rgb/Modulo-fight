/**
 * Persistent user settings (audio, graphics, controls, debug).
 * Kept separate from transient game state so it can be persisted independently.
 */
import { create } from 'zustand';
import { audioManager } from '@/systems/audio/AudioManager';
import { DEFAULT_BINDINGS, type Action, type Bindings } from '@/systems/input/KeyboardController';

export type Quality = 'low' | 'medium' | 'high';

/** Actions the player is allowed to remap to a single custom key. */
export const REMAPPABLE_ACTIONS: Action[] = [
  'up',
  'down',
  'left',
  'right',
  'jump',
  'sprint',
  'light',
  'heavy',
  'special',
  'ultimate',
  'dash',
  'dodge',
  'shield',
  'pause',
];

/** Custom single-key overrides, keyed by action. Unset = use the default. */
export type KeyOverrides = Partial<Record<Action, string>>;

/** Merge custom overrides on top of the defaults, keeping fallback keys (e.g.
 * arrow keys, Escape) alive so remapping never locks the player out. */
export function resolveBindings(overrides: KeyOverrides): Bindings {
  const result = {} as Bindings;
  for (const action of Object.keys(DEFAULT_BINDINGS) as Action[]) {
    const defaults = DEFAULT_BINDINGS[action];
    const custom = overrides[action];
    if (!custom) {
      result[action] = defaults;
      continue;
    }
    const fallback = defaults.filter((c) => c !== defaults[0]);
    result[action] = [custom, ...fallback];
  }
  return result;
}

interface SettingsState {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  quality: Quality;
  showFps: boolean;
  cameraShake: boolean;
  showControls: boolean;
  /** Forces low-power rendering: no shadows/bloom, lower resolution, fewer particles. */
  batterySaver: boolean;
  /** Auto-pause the match when the browser tab loses focus. */
  autoPauseOnBlur: boolean;
  /** Player's custom key overrides. */
  keyOverrides: KeyOverrides;

  setMasterVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setQuality: (q: Quality) => void;
  setShowFps: (s: boolean) => void;
  setCameraShake: (s: boolean) => void;
  setShowControls: (s: boolean) => void;
  setBatterySaver: (s: boolean) => void;
  setAutoPauseOnBlur: (s: boolean) => void;
  setKeyOverride: (action: Action, code: string) => void;
  resetKeyOverrides: () => void;
}

const STORAGE_KEY = 'modulo-fight-settings';

function load(): Partial<SettingsState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persist(state: SettingsState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        masterVolume: state.masterVolume,
        musicVolume: state.musicVolume,
        sfxVolume: state.sfxVolume,
        muted: state.muted,
        quality: state.quality,
        showFps: state.showFps,
        cameraShake: state.cameraShake,
        showControls: state.showControls,
        batterySaver: state.batterySaver,
        autoPauseOnBlur: state.autoPauseOnBlur,
        keyOverrides: state.keyOverrides,
      }),
    );
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

const saved = load();

export const useSettings = create<SettingsState>((set, get) => {
  // Sync initial audio volumes into the audio manager.
  audioManager.masterVolume = saved.masterVolume ?? 0.8;
  audioManager.musicVolume = saved.musicVolume ?? 0.5;
  audioManager.sfxVolume = saved.sfxVolume ?? 0.9;
  audioManager.muted = saved.muted ?? false;
  audioManager.applyVolumes();

  const commit = (): void => persist(get());

  return {
    masterVolume: saved.masterVolume ?? 0.8,
    musicVolume: saved.musicVolume ?? 0.5,
    sfxVolume: saved.sfxVolume ?? 0.9,
    muted: saved.muted ?? false,
    quality: saved.quality ?? 'high',
    showFps: saved.showFps ?? false,
    cameraShake: saved.cameraShake ?? true,
    showControls: saved.showControls ?? true,
    batterySaver: saved.batterySaver ?? false,
    autoPauseOnBlur: saved.autoPauseOnBlur ?? true,
    keyOverrides: saved.keyOverrides ?? {},

    setMasterVolume: (v) => {
      audioManager.setMasterVolume(v);
      set({ masterVolume: v });
      commit();
    },
    setMusicVolume: (v) => {
      audioManager.setMusicVolume(v);
      set({ musicVolume: v });
      commit();
    },
    setSfxVolume: (v) => {
      audioManager.setSfxVolume(v);
      set({ sfxVolume: v });
      commit();
    },
    setMuted: (m) => {
      audioManager.setMuted(m);
      set({ muted: m });
      commit();
    },
    setQuality: (q) => {
      set({ quality: q });
      commit();
    },
    setShowFps: (s) => {
      set({ showFps: s });
      commit();
    },
    setCameraShake: (s) => {
      set({ cameraShake: s });
      commit();
    },
    setShowControls: (s) => {
      set({ showControls: s });
      commit();
    },
    setBatterySaver: (s) => {
      set({ batterySaver: s });
      commit();
    },
    setAutoPauseOnBlur: (s) => {
      set({ autoPauseOnBlur: s });
      commit();
    },
    setKeyOverride: (action, code) => {
      set({ keyOverrides: { ...get().keyOverrides, [action]: code } });
      commit();
    },
    resetKeyOverrides: () => {
      set({ keyOverrides: {} });
      commit();
    },
  };
});
