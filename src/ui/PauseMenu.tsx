/**
 * PauseMenu — overlay shown when the match is paused (P or Esc).
 * Doubles as a controls reference so players can check the scheme mid-match.
 */
import { useDebug } from '@/state/debugStore';
import { audioManager } from '@/systems/audio/AudioManager';
import { ControlsCard } from './Controls';
import { useTripleTap } from './useTripleTap';

interface Props {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseMenu({ onResume, onRestart, onQuit }: Props) {
  const unlockDebug = useDebug((s) => s.unlock);
  const onTitleTap = useTripleTap(() => {
    audioManager.play('confirm');
    unlockDebug();
  });
  return (
    <div className="overlay">
      <div className="panel" style={{ width: 'min(680px, 94vw)', textAlign: 'center' }}>
        <h2 className="tappable" onClick={onTitleTap} title="Tap 3× for debug menu">
          Paused
        </h2>
        <div className="menu-buttons" style={{ margin: '18px auto 4px' }}>
          <button className="btn primary" onClick={onResume}>
            Resume
          </button>
          <button className="btn" onClick={onRestart}>
            Restart
          </button>
          <button className="btn ghost" onClick={onQuit}>
            Quit to Menu
          </button>
        </div>
        <div style={{ marginTop: 18, textAlign: 'left' }}>
          <ControlsCard />
        </div>
      </div>
    </div>
  );
}
