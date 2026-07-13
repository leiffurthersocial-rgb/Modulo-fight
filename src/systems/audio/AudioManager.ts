/**
 * AudioManager — a complete, self-contained audio system.
 *
 * To keep the repository asset-free while still shipping real, reactive sound,
 * every effect is synthesised with the Web Audio API. The public API
 * (`play('hit')`, `startMusic()`, volume controls) is what the rest of the game
 * calls, so swapping in recorded samples later is a drop-in change behind this
 * interface — no gameplay code needs to know.
 */
import type { EventBus, GameEvent } from '@/systems/simulation/events';

export type Sfx =
  | 'hit'
  | 'bigHit'
  | 'jump'
  | 'land'
  | 'attack'
  | 'special'
  | 'ultimate'
  | 'knockout'
  | 'shield'
  | 'syphon'
  | 'select'
  | 'confirm';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private unsubscribe: (() => void) | null = null;

  masterVolume = 0.8;
  musicVolume = 0.5;
  sfxVolume = 0.9;
  muted = false;

  /** Lazily create the AudioContext (must follow a user gesture). */
  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  applyVolumes(): void {
    if (!this.master || !this.musicGain || !this.sfxGain) return;
    this.master.gain.value = this.muted ? 0 : this.masterVolume;
    this.musicGain.gain.value = this.musicVolume;
    this.sfxGain.gain.value = this.sfxVolume;
  }

  setMasterVolume(v: number): void {
    this.masterVolume = v;
    this.applyVolumes();
  }
  setMusicVolume(v: number): void {
    this.musicVolume = v;
    this.applyVolumes();
  }
  setSfxVolume(v: number): void {
    this.sfxVolume = v;
    this.applyVolumes();
  }
  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolumes();
  }

  /** Wire the audio manager to gameplay events. */
  bind(events: EventBus): void {
    this.unbind();
    this.unsubscribe = events.subscribe((e) => this.onEvent(e));
  }

  unbind(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'hit':
        this.play(e.power > 12 ? 'bigHit' : 'hit');
        break;
      case 'jump':
        this.play('jump');
        break;
      case 'land':
        this.play('land');
        break;
      case 'attack':
        this.play('attack');
        break;
      case 'special':
        this.play('special');
        break;
      case 'ultimate':
        this.play('ultimate');
        break;
      case 'knockout':
        this.play('knockout');
        break;
      case 'shield':
        this.play('shield');
        break;
      case 'syphon':
        this.play('syphon');
        break;
    }
  }

  /** Play a one-shot synthesised sound effect. */
  play(sfx: Sfx): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;

    switch (sfx) {
      case 'hit':
        this.blip(ctx, this.sfxGain, t, 220, 140, 0.09, 'square', 0.5);
        this.noise(ctx, this.sfxGain, t, 0.06, 0.25);
        break;
      case 'bigHit':
        this.blip(ctx, this.sfxGain, t, 160, 60, 0.22, 'sawtooth', 0.7);
        this.noise(ctx, this.sfxGain, t, 0.18, 0.4);
        break;
      case 'jump':
        this.blip(ctx, this.sfxGain, t, 300, 620, 0.14, 'sine', 0.4);
        break;
      case 'land':
        this.blip(ctx, this.sfxGain, t, 180, 90, 0.1, 'triangle', 0.35);
        break;
      case 'attack':
        this.blip(ctx, this.sfxGain, t, 520, 380, 0.06, 'triangle', 0.3);
        break;
      case 'special':
        this.blip(ctx, this.sfxGain, t, 420, 880, 0.25, 'sawtooth', 0.5);
        break;
      case 'ultimate':
        this.blip(ctx, this.sfxGain, t, 120, 720, 0.5, 'sawtooth', 0.6);
        this.noise(ctx, this.sfxGain, t, 0.4, 0.3);
        break;
      case 'knockout':
        this.blip(ctx, this.sfxGain, t, 700, 90, 0.4, 'square', 0.6);
        this.noise(ctx, this.sfxGain, t, 0.3, 0.5);
        break;
      case 'shield':
        this.blip(ctx, this.sfxGain, t, 640, 720, 0.12, 'sine', 0.3);
        break;
      case 'syphon':
        // A drain-then-restore sweep: falling tone into a rising shimmer.
        this.blip(ctx, this.sfxGain, t, 720, 240, 0.16, 'sine', 0.28);
        this.blip(ctx, this.sfxGain, t + 0.07, 260, 900, 0.2, 'sine', 0.22);
        break;
      case 'select':
        this.blip(ctx, this.sfxGain, t, 480, 520, 0.05, 'square', 0.25);
        break;
      case 'confirm':
        this.blip(ctx, this.sfxGain, t, 520, 780, 0.12, 'square', 0.3);
        break;
    }
  }

  /** A pitch-swept oscillator blip with an exponential amplitude decay. */
  private blip(
    ctx: AudioContext,
    dest: GainNode,
    t: number,
    freqStart: number,
    freqEnd: number,
    dur: number,
    type: OscillatorType,
    gain: number,
  ): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A short filtered noise burst for impacts. */
  private noise(ctx: AudioContext, dest: GainNode, t: number, dur: number, gain: number): void {
    const frames = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + dur);
  }

  /** Start a simple, loopable arpeggiated background track. */
  startMusic(): void {
    const ctx = this.ensure();
    if (!ctx || !this.musicGain || this.musicTimer !== null) return;
    // A gentle minor-key arpeggio loop; replace with a streamed track later.
    const scale = [220, 261.63, 329.63, 392, 440, 392, 329.63, 261.63];
    let i = 0;
    const stepMs = 260;
    const tick = (): void => {
      if (!this.ctx || !this.musicGain) return;
      const t = this.ctx.currentTime;
      const freq = scale[i % scale.length];
      this.blip(this.ctx, this.musicGain, t, freq, freq, stepMs / 1000, 'triangle', 0.12);
      // Bass note every four steps.
      if (i % 4 === 0) this.blip(this.ctx, this.musicGain, t, freq / 2, freq / 2, 0.5, 'sine', 0.1);
      i += 1;
    };
    this.musicTimer = window.setInterval(tick, stepMs);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  dispose(): void {
    this.stopMusic();
    this.unbind();
    void this.ctx?.close();
    this.ctx = null;
  }
}

/** Shared singleton — the whole app talks to one audio manager. */
export const audioManager = new AudioManager();
