/**
 * Settings — audio, graphics quality and debug toggles.
 */
import { useGame } from '@/state/gameStore';
import { useSettings, type Quality } from '@/state/settingsStore';

const QUALITIES: Quality[] = ['low', 'medium', 'high'];

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

export function Settings() {
  const goto = useGame((s) => s.goto);
  const s = useSettings();

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
          <Slider label="Master Volume" value={s.masterVolume} onChange={s.setMasterVolume} />
          <Slider label="Music Volume" value={s.musicVolume} onChange={s.setMusicVolume} />
          <Slider label="SFX Volume" value={s.sfxVolume} onChange={s.setSfxVolume} />

          <div className="field">
            <span className="field-label">Graphics Quality</span>
            <div className="chips">
              {QUALITIES.map((q) => (
                <button
                  key={q}
                  className={`chip ${s.quality === q ? 'active' : ''}`}
                  onClick={() => s.setQuality(q)}
                >
                  {q[0].toUpperCase() + q.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="row" style={{ gap: 24 }}>
            <button
              className={`chip ${s.muted ? 'active' : ''}`}
              onClick={() => s.setMuted(!s.muted)}
            >
              {s.muted ? '🔇 Muted' : '🔊 Sound On'}
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
          </div>
        </div>
      </div>
    </div>
  );
}
