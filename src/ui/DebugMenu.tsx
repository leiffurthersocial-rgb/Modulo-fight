/**
 * DebugMenu — a hidden developer/experiment panel.
 *
 * Unlocked by tapping the logo three times (main menu or pause). It exposes
 * live simulation tuning (time-scale, gravity, knockback), player cheats
 * (invincibility, infinite ultimate, unlimited jumps), bot/visualisation
 * toggles, and — when a match is live — one-shot actions (reset, heal, set
 * damage, charge ultimate, launch). Practice controls appear in practice mode.
 */
import type { TrainingBehavior } from '@/core/debug';
import type { Difficulty } from '@/core/types';
import { FIGHTERS } from '@/fighters/fighterData';
import { useDebug } from '@/state/debugStore';
import { useGame } from '@/state/gameStore';
import type { Simulation } from '@/systems/simulation/Simulation';

interface Props {
  sim?: Simulation | null;
  onClose: () => void;
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button className={`chip ${value ? 'active' : ''}`} onClick={() => onChange(!value)}>
      {label} {value ? 'On' : 'Off'}
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="field">
      <span className="field-label">
        {label} — {format ? format(value) : value.toFixed(2)}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

const BEHAVIORS: { id: TrainingBehavior; label: string }[] = [
  { id: 'stand', label: "Stand (no reaction)" },
  { id: 'ai', label: 'Fight (AI)' },
  { id: 'walk', label: 'Walk' },
  { id: 'jump', label: 'Jump' },
  { id: 'shield', label: 'Shield' },
  { id: 'dodge', label: 'Dodge' },
];

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'insane'];

export function DebugMenu({ sim, onClose }: Props) {
  const d = useDebug();
  const inGame = useGame((s) => s.screen) === 'game';
  const isPractice = sim?.config.mode === 'practice';

  return (
    <div className="overlay" style={{ zIndex: 20 }}>
      <div className="panel" style={{ width: 'min(720px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="row spread">
          <h2>
            Debug Menu <span className="badge">Experimental</span>
          </h2>
          <button className="btn ghost small" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="hint">Live tuning and cheats. Changes apply instantly to the running match.</div>

        {/* Simulation tuning */}
        <div className="debug-section">
          <div className="debug-title">Simulation</div>
          <Slider
            label="Time Scale"
            value={d.timeScale}
            min={0.1}
            max={2}
            step={0.05}
            onChange={(v) => d.setFlag('timeScale', v)}
            format={(v) => `${v.toFixed(2)}×`}
          />
          <Slider
            label="Gravity"
            value={d.gravityScale}
            min={0.2}
            max={2}
            step={0.05}
            onChange={(v) => d.setFlag('gravityScale', v)}
            format={(v) => `${v.toFixed(2)}×`}
          />
          <Slider
            label="Knockback"
            value={d.knockbackScale}
            min={0.2}
            max={3}
            step={0.05}
            onChange={(v) => d.setFlag('knockbackScale', v)}
            format={(v) => `${v.toFixed(2)}×`}
          />
        </div>

        {/* Player cheats */}
        <div className="debug-section">
          <div className="debug-title">Player</div>
          <div className="chips">
            <Toggle label="Invincible" value={d.playerInvincible} onChange={(v) => d.setFlag('playerInvincible', v)} />
            <Toggle label="Infinite Ultimate" value={d.infiniteUlt} onChange={(v) => d.setFlag('infiniteUlt', v)} />
            <Toggle label="Unlimited Jumps" value={d.unlimitedJumps} onChange={(v) => d.setFlag('unlimitedJumps', v)} />
          </div>
        </div>

        {/* Bots + visualization */}
        <div className="debug-section">
          <div className="debug-title">Bots & Visualization</div>
          <div className="chips">
            <Toggle label="Freeze Bots" value={d.freezeBots} onChange={(v) => d.setFlag('freezeBots', v)} />
            <Toggle label="Show Hitboxes" value={d.showHitboxes} onChange={(v) => d.setFlag('showHitboxes', v)} />
            <Toggle label="Show Bounds" value={d.showBounds} onChange={(v) => d.setFlag('showBounds', v)} />
            <Toggle label="Fighter Info" value={d.showFighterInfo} onChange={(v) => d.setFlag('showFighterInfo', v)} />
          </div>
        </div>

        {/* Practice controls */}
        {isPractice && (
          <div className="debug-section">
            <div className="debug-title">Practice Dummy</div>
            <div className="field">
              <span className="field-label">Behavior</span>
              <div className="chips">
                {BEHAVIORS.map((b) => (
                  <button
                    key={b.id}
                    className={`chip ${d.behavior === b.id ? 'active' : ''}`}
                    onClick={() => d.setBehavior(b.id)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
            {d.behavior === 'ai' && (
              <div className="field">
                <span className="field-label">AI Difficulty</span>
                <div className="chips">
                  {DIFFICULTIES.map((diff) => (
                    <button
                      key={diff}
                      className={`chip ${d.difficulty === diff ? 'active' : ''}`}
                      onClick={() => d.setPracticeDifficulty(diff)}
                    >
                      {diff[0].toUpperCase() + diff.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="chips">
              <Toggle label="Immovable" value={d.immovable} onChange={d.setImmovable} />
            </div>
          </div>
        )}

        {/* Live actions */}
        {inGame && sim && (
          <div className="debug-section">
            <div className="debug-title">Live Actions</div>
            <div className="chips">
              <button className="btn small" onClick={() => sim.resetPositions()}>
                Reset Positions
              </button>
              <button className="btn small" onClick={() => sim.healAll()}>
                Heal All
              </button>
              <button className="btn small" onClick={() => sim.chargeUlt()}>
                Charge Ultimate
              </button>
              <button className="btn small" onClick={() => sim.launchPlayer(-1)}>
                Launch ←
              </button>
              <button className="btn small" onClick={() => sim.launchPlayer(1)}>
                Launch →
              </button>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <span className="field-label">Set Player Damage</span>
              <div className="chips">
                {[0, 50, 100, 150, 250].map((n) => (
                  <button key={n} className="btn small" onClick={() => sim.setDamage(n)}>
                    {n}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 18 }}>
          <span className="hint" style={{ margin: 0 }}>
            Roster: {FIGHTERS.length} fighters loaded
          </span>
          <button className="btn ghost small" onClick={() => d.resetFlags()}>
            Reset All Flags
          </button>
        </div>
      </div>
    </div>
  );
}
