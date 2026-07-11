/**
 * MainMenu — the entry screen. Play / Practice / Settings / Credits.
 */
import { useGame } from '@/state/gameStore';
import { audioManager } from '@/systems/audio/AudioManager';

export function MainMenu() {
  const goto = useGame((s) => s.goto);
  const setMode = useGame((s) => s.setMode);

  const start = (mode: 'play' | 'practice'): void => {
    audioManager.play('confirm');
    if (mode === 'practice') {
      setMode('practice');
    }
    goto('characterSelect');
  };

  return (
    <div className="menu">
      <div>
        <h1 className="title">MODULO FIGHT</h1>
        <div className="subtitle">Voxel Arena Brawler</div>
      </div>
      <div className="menu-buttons">
        <button
          className="btn primary"
          onClick={() => {
            setMode('1v1');
            start('play');
          }}
        >
          Play
        </button>
        <button className="btn" onClick={() => start('practice')}>
          Practice
        </button>
        <button className="btn" onClick={() => goto('settings')}>
          Settings
        </button>
        <button className="btn" onClick={() => goto('credits')}>
          Credits
        </button>
      </div>
      <div className="subtitle" style={{ letterSpacing: '0.1em', fontSize: 12 }}>
        WASD move · Space jump · J/K/L attack · Ctrl dash · Esc pause
      </div>
    </div>
  );
}
