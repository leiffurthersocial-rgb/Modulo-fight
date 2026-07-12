/**
 * Results — end-of-match summary. Shows placements + combat stats for normal
 * modes, or a score/record card for Survive.
 */
import { getFighter } from '@/fighters/fighterData';
import { useGame } from '@/state/gameStore';
import { useRecords } from '@/state/recordsStore';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Survive mode end-of-run card: score, wave, record status. */
function SurviveResults() {
  const result = useGame((s) => s.surviveResult);
  const goto = useGame((s) => s.goto);
  const bestScore = useRecords((s) => s.bestScore);
  if (!result) return null;
  const f = getFighter(result.fighterId);

  return (
    <div className="menu">
      <div className="panel" style={{ width: 'min(520px, 94vw)', textAlign: 'center' }}>
        <div className="badge">Run Over</div>
        {result.isRecord && !result.tainted && (
          <div className="record-banner">🏆 New Record!</div>
        )}
        <h2 style={{ fontSize: 30, marginTop: 12 }}>
          <span style={{ marginRight: 8 }}>{f.emoji}</span>
          {f.name} defeated {result.score} {result.score === 1 ? 'opponent' : 'opponents'}
        </h2>

        <div className="survive-score-big">{result.score}</div>
        <div className="fighter-role" style={{ marginBottom: 8 }}>
          Reached wave {result.wave} · Best {bestScore}
        </div>

        {result.tainted && (
          <p className="hint" style={{ color: 'var(--danger)' }}>
            Debug menu was active — this run doesn't count toward records. Disable the debug menu
            (in its panel) to set records again.
          </p>
        )}

        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn primary" onClick={() => goto('game')}>
            Try Again
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

export function Results() {
  const mode = useGame((s) => s.mode);
  const placements = useGame((s) => s.resultPlacements);
  const goto = useGame((s) => s.goto);

  if (mode === 'survive') return <SurviveResults />;

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
