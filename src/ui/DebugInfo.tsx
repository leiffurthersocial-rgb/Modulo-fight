/**
 * DebugInfo — live per-fighter data readout, toggled from the debug menu.
 * Reads the throttled HUD snapshot so it never touches the simulation loop.
 */
import { useDebug } from '@/state/debugStore';
import { useGame } from '@/state/gameStore';

export function DebugInfo() {
  const show = useDebug((s) => s.showFighterInfo);
  const fighters = useGame((s) => s.hud.fighters);
  if (!show) return null;

  return (
    <div className="debug-info">
      {fighters.map((f) => (
        <div key={f.index} className="debug-info-card" style={{ borderLeftColor: f.accent }}>
          {`${f.name}${f.isPlayer ? ' (P)' : ''}  ${Math.round(f.damage)}%  x${f.stocks}\n` +
            `state ${f.state}${f.grounded ? ' ▉' : ' ·'}  ult ${(f.ultCharge * 100) | 0}%\n` +
            `pos ${f.x.toFixed(1)},${f.y.toFixed(1)}  vel ${f.vx.toFixed(1)},${f.vy.toFixed(1)}`}
        </div>
      ))}
    </div>
  );
}
