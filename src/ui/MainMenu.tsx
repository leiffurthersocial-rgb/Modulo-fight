/**
 * MainMenu — the entry screen. Play / Practice / Settings / Credits.
 */
import { FIGHTERS } from '@/fighters/fighterData';
import { useGame } from '@/state/gameStore';
import { useDebug } from '@/state/debugStore';
import { audioManager } from '@/systems/audio/AudioManager';
import { useTripleTap } from './useTripleTap';

export function MainMenu() {
  const goto = useGame((s) => s.goto);
  const setMode = useGame((s) => s.setMode);
  const unlockDebug = useDebug((s) => s.unlock);
  const onLogoTap = useTripleTap(() => {
    audioManager.play('confirm');
    unlockDebug();
  });

  const start = (mode: 'play' | 'practice' | 'survive'): void => {
    audioManager.play('confirm');
    if (mode === 'practice') setMode('practice');
    if (mode === 'survive') setMode('survive');
    goto('characterSelect');
  };

  return (
    <div className="menu menu-hero">
      <div className="menu-enter">
        <h1 className="title tappable" onClick={onLogoTap} title="Modulo Fight">
          MODULO FIGHT
        </h1>
        <div className="subtitle">Voxel Arena Brawler</div>
      </div>
      {/* The roster at a glance — hovering shows each fighter's name. */}
      <div className="roster-strip menu-enter" style={{ animationDelay: '80ms' }}>
        {FIGHTERS.map((f) => (
          <span
            key={f.id}
            className="roster-strip-chip"
            title={`${f.name} — ${f.role}`}
            style={{ borderColor: f.appearance.accent }}
          >
            {f.emoji}
          </span>
        ))}
      </div>
      <div className="menu-buttons">
        <button
          className="btn primary menu-enter"
          onClick={() => {
            setMode('1v1');
            start('play');
          }}
        >
          Play
        </button>
        <button className="btn survive menu-enter" style={{ animationDelay: '60ms' }} onClick={() => start('survive')}>
          🏆 Survive
        </button>
        <button className="btn menu-enter" style={{ animationDelay: '120ms' }} onClick={() => start('practice')}>
          Practice
        </button>
        <button className="btn menu-enter" style={{ animationDelay: '180ms' }} onClick={() => goto('settings')}>
          Settings
        </button>
        <button className="btn menu-enter" style={{ animationDelay: '240ms' }} onClick={() => goto('credits')}>
          Credits
        </button>
      </div>
      <div className="subtitle menu-enter" style={{ letterSpacing: '0.1em', fontSize: 12, animationDelay: '300ms' }}>
        WASD move · Space jump · J/K/L attack · U ultimate · I dash · P pause
      </div>
    </div>
  );
}
