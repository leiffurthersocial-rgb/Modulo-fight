/**
 * CharacterSelect — pick fighter, mode, arena, difficulty and rules.
 *
 * Reads and writes the match selections in the game store; pressing Start
 * transitions to the game screen, which reads those selections to build the
 * match.
 */
import { useMemo, type CSSProperties } from 'react';
import type { Difficulty, GameMode } from '@/core/types';
import { ARENAS } from '@/arenas/arenaData';
import { FIGHTERS, getFighter } from '@/fighters/fighterData';
import type { TrainingBehavior } from '@/core/debug';
import { useGame } from '@/state/gameStore';
import { useDebug } from '@/state/debugStore';
import { useRecords } from '@/state/recordsStore';
import { audioManager } from '@/systems/audio/AudioManager';
import { StatBars } from './StatBars';
import { ControlsCard } from './Controls';

const MODES: { id: GameMode; label: string }[] = [
  { id: '1v1', label: '1v1' },
  { id: 'ffa4', label: '4-Player FFA' },
  { id: 'ffa8', label: '8-Player FFA' },
];

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'insane'];

const BEHAVIORS: { id: TrainingBehavior; label: string }[] = [
  { id: 'stand', label: 'No Reaction' },
  { id: 'ai', label: 'Fight (AI)' },
  { id: 'walk', label: 'Walk' },
  { id: 'jump', label: 'Jump' },
  { id: 'shield', label: 'Shield' },
  { id: 'dodge', label: 'Dodge' },
];

export function CharacterSelect() {
  const {
    mode,
    arenaId,
    playerFighterId,
    difficulty,
    stocks,
    setMode,
    setArena,
    setPlayerFighter,
    setDifficulty,
    setStocks,
    duelOpponentId,
    setDuelOpponent,
    practiceOpponentId,
    setPracticeOpponent,
    practiceStocks,
    setPracticeStocks,
    goto,
  } = useGame();
  const behavior = useDebug((s) => s.behavior);
  const immovable = useDebug((s) => s.immovable);
  const setBehavior = useDebug((s) => s.setBehavior);
  const setImmovable = useDebug((s) => s.setImmovable);
  const bestScore = useRecords((s) => s.bestScore);
  const bestFighterId = useRecords((s) => s.bestFighterId);
  const fighterBest = useRecords((s) => s.perFighter[playerFighterId] ?? 0);

  const isPractice = mode === 'practice';
  const isSurvive = mode === 'survive';
  const selected = useMemo(() => getFighter(playerFighterId), [playerFighterId]);

  const start = (): void => {
    audioManager.play('confirm');
    goto('game');
  };

  return (
    <div className="menu">
      <div className="panel">
        <div className="row spread">
          <div>
            <h2>Choose Your Fighter</h2>
            <div className="hint">
              {isPractice
                ? 'Practice against a training dummy.'
                : isSurvive
                  ? 'Survive as long as you can against endless opponents.'
                  : 'Select your fighter and the rules of battle.'}
            </div>
          </div>
          <button className="btn ghost small" onClick={() => goto('mainMenu')}>
            ← Back
          </button>
        </div>

        {/* Options */}
        <div className="stack">
          {!isPractice && !isSurvive && (
            <div className="field">
              <span className="field-label">Mode</span>
              <div className="chips">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    className={`chip ${mode === m.id ? 'active' : ''}`}
                    onClick={() => {
                      audioManager.play('select');
                      setMode(m.id);
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSurvive && (
            <div className="survive-info">
              <div className="survive-info-title">🏆 Survive Mode</div>
              <p className="move-desc" style={{ marginTop: 0 }}>
                Standardized so scores compare fairly: <b>Sky Temple</b>, <b>3 lives</b>, and a
                fresh 1-on-1 opponent every time you win. Opponents get tougher the deeper you go.
                Your score is the number of opponents you defeat.
              </p>
              <div className="row" style={{ gap: 18, marginTop: 4 }}>
                <span className="survive-stat">
                  Best <b>{bestScore}</b>
                  {bestFighterId ? ` · ${getFighter(bestFighterId).name}` : ''}
                </span>
                <span className="survive-stat">
                  This fighter <b>{fighterBest}</b>
                </span>
              </div>
            </div>
          )}

          {!isSurvive && (
            <div className="field">
              <span className="field-label">Arena</span>
              <div className="chips">
                {ARENAS.map((a) => (
                  <button
                    key={a.id}
                    className={`chip ${arenaId === a.id ? 'active' : ''} ${a.implemented ? '' : 'disabled'}`}
                    disabled={!a.implemented}
                    onClick={() => {
                      if (!a.implemented) return;
                      audioManager.play('select');
                      setArena(a.id);
                    }}
                    title={a.implemented ? a.description : 'Coming soon'}
                  >
                    {a.name}
                    {!a.implemented && ' 🔒'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === '1v1' && (
            <div className="field">
              <span className="field-label">Opponent</span>
              <div className="chips">
                <button
                  className={`chip ${duelOpponentId === 'random' ? 'active' : ''}`}
                  onClick={() => {
                    audioManager.play('select');
                    setDuelOpponent('random');
                  }}
                >
                  🎲 Random
                </button>
                {FIGHTERS.filter((f) => f.id !== playerFighterId).map((f) => (
                  <button
                    key={f.id}
                    className={`chip ${duelOpponentId === f.id ? 'active' : ''}`}
                    onClick={() => {
                      audioManager.play('select');
                      setDuelOpponent(f.id);
                    }}
                  >
                    {f.emoji} {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isPractice && !isSurvive && (
            <div className="row" style={{ gap: 32 }}>
              <div className="field">
                <span className="field-label">Bot Difficulty</span>
                <div className="chips">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      className={`chip ${difficulty === d ? 'active' : ''}`}
                      onClick={() => {
                        audioManager.play('select');
                        setDifficulty(d);
                      }}
                    >
                      {d[0].toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span className="field-label">Stocks</span>
                <div className="chips">
                  {[1, 2, 3, 5].map((n) => (
                    <button
                      key={n}
                      className={`chip ${stocks === n ? 'active' : ''}`}
                      onClick={() => {
                        audioManager.play('select');
                        setStocks(n);
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isPractice && (
            <div className="stack">
              <div className="field">
                <span className="field-label">Opponent</span>
                <div className="chips">
                  {FIGHTERS.map((f) => (
                    <button
                      key={f.id}
                      className={`chip ${practiceOpponentId === f.id ? 'active' : ''}`}
                      onClick={() => {
                        audioManager.play('select');
                        setPracticeOpponent(f.id);
                      }}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="row" style={{ gap: 32 }}>
                <div className="field">
                  <span className="field-label">Behavior</span>
                  <div className="chips">
                    {BEHAVIORS.map((b) => (
                      <button
                        key={b.id}
                        className={`chip ${behavior === b.id ? 'active' : ''}`}
                        onClick={() => {
                          audioManager.play('select');
                          setBehavior(b.id);
                        }}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <span className="field-label">Knockback</span>
                  <div className="chips">
                    <button
                      className={`chip ${immovable ? 'active' : ''}`}
                      onClick={() => {
                        audioManager.play('select');
                        setImmovable(!immovable);
                      }}
                    >
                      {immovable ? 'Immovable' : 'Normal'}
                    </button>
                  </div>
                </div>
                <div className="field">
                  <span className="field-label">Lives</span>
                  <div className="chips">
                    {[1, 3, 5, 99].map((n) => (
                      <button
                        key={n}
                        className={`chip ${practiceStocks === n ? 'active' : ''}`}
                        onClick={() => {
                          audioManager.play('select');
                          setPracticeStocks(n);
                        }}
                      >
                        {n === 99 ? '∞' : n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="hint" style={{ margin: 0 }}>
                Tip: tap the logo 3× (here or on the pause screen) to open the debug menu for
                live tuning.
              </div>
            </div>
          )}
        </div>

        {/* Roster */}
        <div className="roster">
          {FIGHTERS.map((f) => (
            <button
              key={f.id}
              className={`fighter-card ${playerFighterId === f.id ? 'active' : ''}`}
              style={{ '--card-accent': f.appearance.accent } as CSSProperties}
              onClick={() => {
                audioManager.play('select');
                setPlayerFighter(f.id);
              }}
            >
              <span
                className="fighter-swatch"
                style={{
                  background: `linear-gradient(160deg, ${f.appearance.shirt}, ${f.appearance.accent})`,
                }}
              >
                <span className="fighter-emoji">{f.emoji}</span>
              </span>
              <span className="fighter-name">{f.name}</span>
              <span className="fighter-role">{f.role}</span>
            </button>
          ))}
        </div>

        {/* Selected detail */}
        <div className="detail">
          <div>
            <h2 style={{ fontSize: 20 }}>
              <span style={{ marginRight: 6 }}>{selected.emoji}</span>
              {selected.name} <span className="badge">{selected.role}</span>
            </h2>
            <p style={{ marginTop: 6, fontSize: 14, color: 'var(--text)' }}>{selected.blurb}</p>
            <p className="hint" style={{ marginTop: 4 }}>
              {selected.personality}
            </p>
            <StatBars fighter={selected} />
          </div>
          <div>
            <div className="move-block">
              <span className="move-head">⭐ Passive</span>
              <p className="move-desc">{selected.passiveDescription}</p>
            </div>
            <div className="move-block">
              <span className="move-head">
                <span className="kbd">L</span> {selected.attacks.special.name}
              </span>
              <p className="move-desc">{selected.attacks.special.description}</p>
            </div>
            <div className="move-block">
              <span className="move-head">
                <span className="kbd">U</span> {selected.attacks.ultimate.name} — Ultimate
              </span>
              <p className="move-desc">{selected.attacks.ultimate.description}</p>
            </div>
            <div className="move-block">
              <span className="move-head">Basics</span>
              <p className="move-desc">
                <b>{selected.attacks.light.name}</b> ({selected.attacks.light.description}) ·{' '}
                <b>{selected.attacks.heavy.name}</b> ({selected.attacks.heavy.description})
              </p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <span className="field-label">Controls</span>
          <ControlsCard />
        </div>

        <div className="row" style={{ marginTop: 22, justifyContent: 'flex-end' }}>
          <button className="btn primary" style={{ minWidth: 200 }} onClick={start}>
            {isSurvive ? 'Start Survive' : 'Start Match'}
          </button>
        </div>
      </div>
    </div>
  );
}
