/**
 * Results — end-of-match placements with rematch / menu options.
 */
import { getFighter } from '@/fighters/fighterData';
import { useGame } from '@/state/gameStore';

const MEDALS = ['🥇', '🥈', '🥉'];

export function Results() {
  const placements = useGame((s) => s.resultPlacements);
  const goto = useGame((s) => s.goto);

  const winner = placements[0];

  return (
    <div className="menu">
      <div className="panel" style={{ width: 'min(560px, 94vw)', textAlign: 'center' }}>
        <div className="badge">Match Complete</div>
        <h2 style={{ fontSize: 34, marginTop: 12 }}>
          {winner ? `${winner.name} Wins!` : 'Draw'}
        </h2>

        <div className="results-list" style={{ textAlign: 'left' }}>
          {placements.map((p, i) => {
            const f = getFighter(p.configId);
            return (
              <div key={p.index} className="result-row">
                <span className="result-place">{MEDALS[i] ?? `#${i + 1}`}</span>
                <span
                  className="fighter-swatch"
                  style={{
                    width: 34,
                    height: 34,
                    background: `linear-gradient(160deg, ${f.appearance.shirt}, ${f.appearance.accent})`,
                  }}
                >
                  <span className="fighter-emoji" style={{ fontSize: 18 }}>
                    {f.emoji}
                  </span>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{f.name}</div>
                  <div className="fighter-role">{f.role}</div>
                </div>
                <div className="result-stats">
                  <span title="Damage dealt">💥 {p.damageDealt}%</span>
                  <span title="Damage taken">🩹 {p.damageTaken}%</span>
                  <span title="KOs scored">☠️ {p.kos}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
          <button className="btn primary" onClick={() => goto('game')}>
            Rematch
          </button>
          <button className="btn" onClick={() => goto('characterSelect')}>
            Change Fighter
          </button>
          <button className="btn ghost" onClick={() => goto('mainMenu')}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
