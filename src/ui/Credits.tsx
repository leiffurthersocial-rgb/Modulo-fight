/**
 * Credits — roster overview and controls reference.
 */
import { FIGHTERS } from '@/fighters/fighterData';
import { useGame } from '@/state/gameStore';
import { ControlsCard } from './Controls';

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
            <ControlsCard />
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
