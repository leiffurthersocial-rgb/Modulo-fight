/**
 * MainMenu — the entry screen. Play / Practice / Settings / Credits.
 */
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
        <h1 className="title tappable" onClick={onLogoTap} title="Modulo Fight">
          MODULO FIGHT
        </h1>
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
        WASD move · Space jump · J/K/L attack · U ultimate · I dash · P pause
      </div>
    </div>
  );
}
