/**
 * HUD — damage %, stocks, ultimate meter, timer and optional FPS readout.
 *
 * Renders from the throttled `hud` snapshot in the store, so it updates a few
 * times per second rather than every frame — the DOM never competes with the
 * WebGL loop for the main thread.
 */
import { useGame } from '@/state/gameStore';
import { useSettings } from '@/state/settingsStore';
import { getFighter } from '@/fighters/fighterData';

function formatTime(seconds: number): string {
  if (seconds <= 0) return '∞';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function HUD() {
  const hud = useGame((s) => s.hud);
  const fps = useGame((s) => s.fps);
  const mode = useGame((s) => s.mode);
  const showFps = useSettings((s) => s.showFps);
  const timeLimit = useGame((s) => s.timeLimit);

  const player = hud.fighters.find((f) => f.isPlayer);
  const ultReady = !!player && !player.eliminated && player.ultCharge >= 1;
  const combo = player && !player.eliminated ? player.comboCount : 0;
  const isSurvive = mode === 'survive';

  return (
    <div className="hud">
      {isSurvive ? (
        <div className="hud-top">
          <div className="hud-survive">
            <span className="hud-survive-label">SCORE</span>
            <span className="hud-survive-score">{hud.score ?? 0}</span>
            <span className="hud-survive-wave">Wave {hud.wave ?? 1}</span>
          </div>
        </div>
      ) : (
        timeLimit > 0 && (
          <div className="hud-top">
            <div className="hud-timer">{formatTime(hud.timeRemaining)}</div>
          </div>
        )
      )}

      {/* Prominent notice when the player's ultimate is charged. */}
      {ultReady && (
        <div className="ult-banner">
          <span className="ult-banner-bolt">⚡</span> ULTIMATE READY
          <span className="ult-banner-key">press U</span>
        </div>
      )}

      {/* Live combo counter for the player. */}
      {combo >= 2 && (
        <div className="combo" key={combo}>
          <span className="combo-count">{combo}</span>
          <span className="combo-label">HIT COMBO</span>
        </div>
      )}

      {showFps && <div className="fps">{fps} FPS</div>}

      <div className="hud-bottom">
        {hud.fighters.map((f) => {
          const damageColor = `hsl(${Math.max(0, 55 - f.damage * 0.45)}, 90%, ${60 - Math.min(f.damage * 0.12, 22)}%)`;
          const cardReady = !f.eliminated && f.ultCharge >= 1;
          return (
            <div
              key={f.index}
              className={`hud-fighter ${f.eliminated ? 'out' : ''} ${f.isPlayer ? 'player' : ''} ${cardReady ? 'ult-ready' : ''}`}
            >
              <div className="hud-name">
                <span className="hud-portrait" style={{ borderColor: f.accent }}>
                  {getFighter(f.configId).emoji}
                </span>
                {f.name}
                {f.isPlayer && ' (You)'}
              </div>
              <div className="hud-damage" style={{ color: f.eliminated ? '#666' : damageColor }}>
                {f.eliminated ? 'OUT' : `${Math.round(f.damage)}%`}
              </div>
              <div className="hud-stocks">
                {f.stocks > 6 ? (
                  <span className="hud-stock-count" style={{ color: f.accent }}>
                    ∞
                  </span>
                ) : (
                  Array.from({ length: f.stocks }).map((_, i) => (
                    <span key={i} className="hud-stock" style={{ background: f.accent }} />
                  ))
                )}
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
