/**
 * App — top-level screen router.
 *
 * A tiny switch over the current screen. The heavy 3D game screen is lazily
 * loaded so the menu paints instantly and the WebGL bundle is only fetched when
 * the player actually starts a match.
 */
import { Suspense, lazy } from 'react';
import { useGame } from '@/state/gameStore';
import { MainMenu } from '@/ui/MainMenu';
import { CharacterSelect } from '@/ui/CharacterSelect';
import { Settings } from '@/ui/Settings';
import { Credits } from '@/ui/Credits';
import { Results } from '@/ui/Results';

const GameScreen = lazy(() =>
  import('@/ui/GameScreen').then((m) => ({ default: m.GameScreen })),
);

export function App() {
  const screen = useGame((s) => s.screen);

  return (
    <div className="app">
      {screen === 'mainMenu' && <MainMenu />}
      {screen === 'characterSelect' && <CharacterSelect />}
      {screen === 'settings' && <Settings />}
      {screen === 'credits' && <Credits />}
      {screen === 'results' && <Results />}
      {screen === 'game' && (
        <Suspense fallback={<div className="loading">Entering the arena…</div>}>
          <GameScreen />
        </Suspense>
      )}
    </div>
  );
}
