/**
 * PauseMenu — overlay shown when the match is paused (Esc).
 */
interface Props {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseMenu({ onResume, onRestart, onQuit }: Props) {
  return (
    <div className="overlay">
      <div className="panel" style={{ width: 'min(420px, 90vw)', textAlign: 'center' }}>
        <h2>Paused</h2>
        <div className="menu-buttons" style={{ margin: '22px auto 0' }}>
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
      </div>
    </div>
  );
}
