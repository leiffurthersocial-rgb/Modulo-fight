/**
 * HUD — damage %, stocks, ultimate meter, timer and optional FPS readout.
 *
 * Renders from the throttled `hud` snapshot in the store, so it updates a few
 * times per second rather than every frame — the DOM never competes with the
 * WebGL loop for the main thread.
 */
import { useGame } from '@/state/gameStore';
import { useSettings } from '@/state/settingsStore';

function formatTime(seconds: number): string {
  if (seconds <= 0) return '∞';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function HUD() {
  const hud = useGame((s) => s.hud);
  const fps = useGame((s) => s.fps);
  const showFps = useSettings((s) => s.showFps);
  const timeLimit = useGame((s) => s.timeLimit);

  return (
    <div className="hud">
      {timeLimit > 0 && (
        <div className="hud-top">
          <div className="hud-timer">{formatTime(hud.timeRemaining)}</div>
        </div>
      )}

      {showFps && <div className="fps">{fps} FPS</div>}

      <div className="hud-bottom">
        {hud.fighters.map((f) => {
          const damageColor = `hsl(${Math.max(0, 55 - f.damage * 0.45)}, 90%, ${60 - Math.min(f.damage * 0.12, 22)}%)`;
          return (
            <div key={f.index} className={`hud-fighter ${f.eliminated ? 'out' : ''}`}>
              <div className="hud-name">
                <span className="hud-dot" style={{ background: f.accent }} />
                {f.name}
                {f.isPlayer && ' (You)'}
              </div>
              <div className="hud-damage" style={{ color: f.eliminated ? '#666' : damageColor }}>
                {f.eliminated ? 'OUT' : `${Math.round(f.damage)}%`}
              </div>
              <div className="hud-stocks">
                {Array.from({ length: f.stocks }).map((_, i) => (
                  <span key={i} className="hud-stock" style={{ background: f.accent }} />
                ))}
              </div>
              <div className={`hud-ult ${f.ultCharge >= 1 ? 'ready' : ''}`}>
                <div className="hud-ult-fill" style={{ width: `${f.ultCharge * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
