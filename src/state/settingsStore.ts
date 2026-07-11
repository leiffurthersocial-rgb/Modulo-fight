/**
 * Persistent user settings (audio, graphics, debug).
 * Kept separate from transient game state so it can be persisted independently.
 */
import { create } from 'zustand';
import { audioManager } from '@/systems/audio/AudioManager';

export type Quality = 'low' | 'medium' | 'high';

interface SettingsState {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  quality: Quality;
  showFps: boolean;
  cameraShake: boolean;
  showControls: boolean;

  setMasterVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setQuality: (q: Quality) => void;
  setShowFps: (s: boolean) => void;
  setCameraShake: (s: boolean) => void;
  setShowControls: (s: boolean) => void;
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
  };
});
