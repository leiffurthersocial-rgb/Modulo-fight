/**
 * Announcements — transient combat callouts (KO!, ultimate) driven directly by
 * the simulation's event bus, independent of the throttled HUD snapshot so they
 * land on the exact frame the event fires. Pure DOM, cleans itself up.
 */
import { useEffect, useState } from 'react';
import { getFighter } from '@/fighters/fighterData';
import { useSettings } from '@/state/settingsStore';
import type { Simulation } from '@/systems/simulation/Simulation';

interface Callout {
  id: number;
  kind: 'ko' | 'ult';
  text: string;
  sub: string;
  color: string;
}

interface Flash {
  id: number;
  color: string;
}

export function Announcements({ sim }: { sim: Simulation }) {
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const showCallouts = useSettings((s) => s.announcements);
  // Screen flash is skipped in battery saver — full-screen composited fades
  // are among the most expensive things a mobile GPU can do.
  const showFlash = useSettings((s) => s.screenFlash && !s.batterySaver);

  useEffect(() => {
    let nextId = 1;
    const push = (c: Omit<Callout, 'id'>): void => {
      const id = nextId++;
      setCallouts((cs) => [...cs, { ...c, id }]);
      window.setTimeout(() => {
        setCallouts((cs) => cs.filter((x) => x.id !== id));
      }, 1400);
    };
    // A brief full-screen accent flash makes ultimates and KOs land visually
    // even when the camera is zoomed far out.
    const flash = (color: string): void => {
      const id = nextId++;
      setFlashes((fs) => [...fs, { id, color }]);
      window.setTimeout(() => {
        setFlashes((fs) => fs.filter((x) => x.id !== id));
      }, 550);
    };
    const unsub = sim.events.subscribe((e) => {
      if (e.type === 'knockout') {
        const victim = getFighter(e.victimId);
        push({
          kind: 'ko',
          text: 'K.O.!',
          sub: victim.name,
          color: '#ff5d73',
        });
        flash('#ff5d73');
      } else if (e.type === 'ultimate') {
        const f = getFighter(e.fighterId);
        push({
          kind: 'ult',
          text: `${f.name.toUpperCase()} ULTIMATE`,
          sub: f.attacks.ultimate.name,
          color: f.appearance.accent,
        });
        flash(f.appearance.accent);
      }
    });
    return unsub;
  }, [sim]);

  if (callouts.length === 0 && flashes.length === 0) return null;
  return (
    <>
      {showFlash &&
        flashes.map((f) => (
          <div
            key={f.id}
            className="screen-flash"
            style={{
              background: `radial-gradient(120vmax circle at 50% 55%, ${f.color}66 0%, ${f.color}22 35%, transparent 70%)`,
            }}
          />
        ))}
      {showCallouts && (
        <div className="announce">
          {callouts.map((c) => (
            <div key={c.id} className={`announce-item announce-${c.kind}`} style={{ color: c.color }}>
              <span className="announce-text">{c.text}</span>
              <span className="announce-sub">{c.sub}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
