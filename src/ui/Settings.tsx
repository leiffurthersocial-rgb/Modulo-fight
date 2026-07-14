/**
 * Settings — audio, graphics, performance, controls and debug toggles.
 */
import { useEffect, useState } from 'react';
import { useGame } from '@/state/gameStore';
import {
  REMAPPABLE_ACTIONS,
  resolveBindings,
  useSettings,
  type Quality,
} from '@/state/settingsStore';
import type { Action } from '@/systems/input/KeyboardController';
import { codeLabel } from './Controls';

const QUALITIES: Quality[] = ['low', 'medium', 'high'];

const ACTION_LABELS: Record<Action, string> = {
  up: 'Move Up',
  down: 'Move Down / Drop',
  left: 'Move Left',
  right: 'Move Right',
  jump: 'Jump',
  sprint: 'Sprint',
  light: 'Light Attack',
  heavy: 'Heavy Attack',
  special: 'Special',
  ultimate: 'Ultimate',
  dash: 'Dash',
  dodge: 'Dodge',
  shield: 'Shield',
  pause: 'Pause',
};

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">
        {label} — {Math.round(value * 100)}%
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

/** One remappable action: shows its current key and lets you capture a new one. */
function KeyRemapRow({
  action,
  currentCode,
  onPick,
}: {
  action: Action;
  currentCode: string;
  onPick: (code: string) => void;
}) {
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!listening) return;
    const handler = (e: KeyboardEvent): void => {
      e.preventDefault();
      onPick(e.code);
      setListening(false);
    };
    window.addEventListener('keydown', handler, { once: true });
    return () => window.removeEventListener('keydown', handler);
  }, [listening, onPick]);

  return (
    <div className="controls-card-row">
      <span>{ACTION_LABELS[action]}</span>
      <button
        className={`kbd remap-btn ${listening ? 'listening' : ''}`}
        onClick={() => setListening(true)}
      >
        {listening ? '…' : codeLabel(currentCode)}
      </button>
    </div>
  );
}

export function Settings() {
  const goto = useGame((s) => s.goto);
  const s = useSettings();
  const effectiveBindings = resolveBindings(s.keyOverrides);

  return (
    <div className="menu">
      <div className="panel">
        <div className="row spread">
          <h2>Settings</h2>
          <button className="btn ghost small" onClick={() => goto('mainMenu')}>
            ← Back
          </button>
        </div>

        <div className="stack" style={{ marginTop: 18 }}>
          <span className="field-label">Audio</span>
          <Slider label="Master Volume" value={s.masterVolume} onChange={s.setMasterVolume} />
          <Slider label="Music Volume" value={s.musicVolume} onChange={s.setMusicVolume} />
          <Slider label="SFX Volume" value={s.sfxVolume} onChange={s.setSfxVolume} />
          <div className="row" style={{ gap: 24 }}>
            <button
              className={`chip ${s.muted ? 'active' : ''}`}
              onClick={() => s.setMuted(!s.muted)}
            >
              {s.muted ? '🔇 Muted' : '🔊 Sound On'}
            </button>
          </div>

          <span className="field-label" style={{ marginTop: 8 }}>
            Graphics Quality
          </span>
          <div className="chips">
            {QUALITIES.map((q) => (
              <button
                key={q}
                className={`chip ${s.quality === q ? 'active' : ''} ${s.batterySaver ? 'disabled' : ''}`}
                disabled={s.batterySaver}
                onClick={() => s.setQuality(q)}
              >
                {q[0].toUpperCase() + q.slice(1)}
              </button>
            ))}
          </div>

          <span className="field-label" style={{ marginTop: 8 }}>
            Performance & Display
          </span>
          <div className="chips">
            <button
              className={`chip ${s.batterySaver ? 'active' : ''}`}
              onClick={() => s.setBatterySaver(!s.batterySaver)}
              title="Forces low resolution, no shadows/bloom, and fewer particles to save power"
            >
              🔋 Battery Saver {s.batterySaver ? 'On' : 'Off'}
            </button>
            <button
              className={`chip ${s.showFps ? 'active' : ''}`}
              onClick={() => s.setShowFps(!s.showFps)}
            >
              FPS Counter {s.showFps ? 'On' : 'Off'}
            </button>
            <button
              className={`chip ${s.cameraShake ? 'active' : ''}`}
              onClick={() => s.setCameraShake(!s.cameraShake)}
            >
              Camera Shake {s.cameraShake ? 'On' : 'Off'}
            </button>
            <button
              className={`chip ${s.showControls ? 'active' : ''}`}
              onClick={() => s.setShowControls(!s.showControls)}
            >
              Controls Legend {s.showControls ? 'On' : 'Off'}
            </button>
            <button
              className={`chip ${s.autoPauseOnBlur ? 'active' : ''}`}
              onClick={() => s.setAutoPauseOnBlur(!s.autoPauseOnBlur)}
              title="Automatically pauses the match when you switch tabs or windows"
            >
              Auto-Pause on Tab Switch {s.autoPauseOnBlur ? 'On' : 'Off'}
            </button>
          </div>

          <span className="field-label" style={{ marginTop: 8 }}>
            Combat Feedback
          </span>
          <div className="chips">
            <button
              className={`chip ${s.hitMarkers ? 'active' : ''}`}
              onClick={() => s.setHitMarkers(!s.hitMarkers)}
              title="Shows an impact marker on every hit that connects"
            >
              Hit Markers {s.hitMarkers ? 'On' : 'Off'}
            </button>
            <button
              className={`chip ${s.screenFlash ? 'active' : ''}`}
              onClick={() => s.setScreenFlash(!s.screenFlash)}
              title="Full-screen colour flash on ultimates and KOs — turn off if it's too intense"
            >
              Screen Flash {s.screenFlash ? 'On' : 'Off'}
            </button>
            <button
              className={`chip ${s.announcements ? 'active' : ''}`}
              onClick={() => s.setAnnouncements(!s.announcements)}
              title="Big K.O. and ultimate callout banners"
            >
              Battle Callouts {s.announcements ? 'On' : 'Off'}
            </button>
            <button
              className={`chip ${s.comboCounter ? 'active' : ''}`}
              onClick={() => s.setComboCounter(!s.comboCounter)}
              title="On-screen combo counter while you chain hits"
            >
              Combo Counter {s.comboCounter ? 'On' : 'Off'}
            </button>
            <button
              className={`chip ${s.speedStreaks ? 'active' : ''}`}
              onClick={() => s.setSpeedStreaks(!s.speedStreaks)}
              title="Motion streaks behind fast-moving fighters"
            >
              Speed Streaks {s.speedStreaks ? 'On' : 'Off'}
            </button>
          </div>

          <span className="field-label" style={{ marginTop: 8 }}>
            Camera & Effects
          </span>
          <div className="row" style={{ gap: 32 }}>
            <div className="field">
              <span className="field-label">Camera Zoom</span>
              <div className="chips">
                {(['close', 'default', 'wide'] as const).map((z) => (
                  <button
                    key={z}
                    className={`chip ${s.cameraZoom === z ? 'active' : ''}`}
                    onClick={() => s.setCameraZoom(z)}
                  >
                    {z[0].toUpperCase() + z.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-label">Particle Amount</span>
              <div className="chips">
                {(['low', 'normal', 'high'] as const).map((a) => (
                  <button
                    key={a}
                    className={`chip ${s.effectsAmount === a ? 'active' : ''}`}
                    onClick={() => s.setEffectsAmount(a)}
                    title="Applies from the next match"
                  >
                    {a[0].toUpperCase() + a.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="row spread" style={{ marginTop: 8 }}>
            <span className="field-label" style={{ margin: 0 }}>
              Controls — click a key to rebind
            </span>
            <button className="btn ghost small" onClick={() => s.resetKeyOverrides()}>
              Reset to Defaults
            </button>
          </div>
          <div className="controls-card">
            <div className="controls-group">
              {REMAPPABLE_ACTIONS.map((action) => (
                <KeyRemapRow
                  key={action}
                  action={action}
                  currentCode={effectiveBindings[action][0]}
                  onPick={(code) => s.setKeyOverride(action, code)}
                />
              ))}
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              className="btn ghost small"
              onClick={() => {
                if (confirm('Reset all settings (audio, graphics, controls) to defaults?')) {
                  s.resetAll();
                }
              }}
            >
              Reset All Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
