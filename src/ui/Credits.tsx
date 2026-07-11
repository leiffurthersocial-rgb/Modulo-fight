/**
 * Credits — roster overview and controls reference.
 */
import { FIGHTERS } from '@/fighters/fighterData';
import { useGame } from '@/state/gameStore';

const CONTROLS: [string, string][] = [
  ['Move', 'W A S D'],
  ['Jump / Double Jump', 'Space'],
  ['Sprint', 'Shift'],
  ['Light Attack', 'J'],
  ['Heavy Attack', 'K'],
  ['Special', 'L'],
  ['Ultimate', 'U'],
  ['Dash', 'Ctrl'],
  ['Dodge', 'H'],
  ['Shield', 'G'],
  ['Pause', 'Esc'],
];

export function Credits() {
  const goto = useGame((s) => s.goto);

  return (
    <div className="menu">
      <div className="panel">
        <div className="row spread">
          <h2>Credits & Controls</h2>
          <button className="btn ghost small" onClick={() => goto('mainMenu')}>
            ← Back
          </button>
        </div>

        <div className="detail">
          <div>
            <h2 style={{ fontSize: 18, marginTop: 12 }}>The Roster</h2>
            <div className="credits-list">
              {FIGHTERS.map((f) => (
                <div key={f.id}>
                  <b>{f.name}</b> — {f.role}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: 18, marginTop: 12 }}>Controls</h2>
            <div className="controls-grid">
              {CONTROLS.map(([action, key]) => (
                <div key={action} className="row spread">
                  <span>{action}</span>
                  <span className="k">{key}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="hint" style={{ marginTop: 20 }}>
          Modulo Fight — a modular voxel platform fighter built with React Three Fiber,
          Three.js, Rapier and Zustand. Knock your opponents off the stage to win!
        </p>
      </div>
    </div>
  );
}
