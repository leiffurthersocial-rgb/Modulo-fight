/**
 * CharacterSelect — pick fighter, mode, arena, difficulty and rules.
 *
 * Reads and writes the match selections in the game store; pressing Start
 * transitions to the game screen, which reads those selections to build the
 * match.
 */
import { useMemo } from 'react';
import type { Difficulty, GameMode } from '@/core/types';
import { ARENAS } from '@/arenas/arenaData';
import { FIGHTERS, getFighter } from '@/fighters/fighterData';
import { useGame } from '@/state/gameStore';
import { audioManager } from '@/systems/audio/AudioManager';
import { StatBars } from './StatBars';
import { ControlsCard } from './Controls';

const MODES: { id: GameMode; label: string }[] = [
  { id: '1v1', label: '1v1' },
  { id: 'ffa4', label: '4-Player FFA' },
  { id: 'ffa8', label: '8-Player FFA' },
];

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'insane'];

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
    goto,
  } = useGame();

  const isPractice = mode === 'practice';
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
              {isPractice ? 'Practice against a training dummy.' : 'Select your fighter and the rules of battle.'}
            </div>
          </div>
          <button className="btn ghost small" onClick={() => goto('mainMenu')}>
            ← Back
          </button>
        </div>

        {/* Options */}
        <div className="stack">
          {!isPractice && (
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

          {!isPractice && (
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
        </div>

        {/* Roster */}
        <div className="roster">
          {FIGHTERS.map((f) => (
            <button
              key={f.id}
              className={`fighter-card ${playerFighterId === f.id ? 'active' : ''}`}
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
              />
              <span className="fighter-name">{f.name}</span>
              <span className="fighter-role">{f.role}</span>
            </button>
          ))}
        </div>

        {/* Selected detail */}
        <div className="detail">
          <div>
            <h2 style={{ fontSize: 20 }}>
              {selected.name} <span className="badge">{selected.role}</span>
            </h2>
            <p className="hint" style={{ marginTop: 6 }}>
              {selected.personality}
            </p>
            <StatBars fighter={selected} />
          </div>
          <div>
            <div className="move-line">
              <b>Passive:</b> {selected.passiveDescription}
            </div>
            <div className="move-line">
              <b>Light:</b> {selected.attacks.light.name}
            </div>
            <div className="move-line">
              <b>Heavy:</b> {selected.attacks.heavy.name}
            </div>
            <div className="move-line">
              <b>Special:</b> {selected.attacks.special.name}
            </div>
            <div className="move-line">
              <b>Ultimate:</b> {selected.attacks.ultimate.name}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <span className="field-label">Controls</span>
          <ControlsCard />
        </div>

        <div className="row" style={{ marginTop: 22, justifyContent: 'flex-end' }}>
          <button className="btn primary" style={{ minWidth: 200 }} onClick={start}>
            Start Match
          </button>
        </div>
      </div>
    </div>
  );
}
