/**
 * Announcements — transient combat callouts (KO!, ultimate) driven directly by
 * the simulation's event bus, independent of the throttled HUD snapshot so they
 * land on the exact frame the event fires. Pure DOM, cleans itself up.
 */
import { useEffect, useState } from 'react';
import { getFighter } from '@/fighters/fighterData';
import type { Simulation } from '@/systems/simulation/Simulation';

interface Callout {
  id: number;
  kind: 'ko' | 'ult';
  text: string;
  sub: string;
  color: string;
}

export function Announcements({ sim }: { sim: Simulation }) {
  const [callouts, setCallouts] = useState<Callout[]>([]);

  useEffect(() => {
    let nextId = 1;
    const push = (c: Omit<Callout, 'id'>): void => {
      const id = nextId++;
      setCallouts((cs) => [...cs, { ...c, id }]);
      window.setTimeout(() => {
        setCallouts((cs) => cs.filter((x) => x.id !== id));
      }, 1400);
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
      } else if (e.type === 'ultimate') {
        const f = getFighter(e.fighterId);
        push({
          kind: 'ult',
          text: `${f.name.toUpperCase()} ULTIMATE`,
          sub: f.attacks.ultimate.name,
          color: f.appearance.accent,
        });
      }
    });
    return unsub;
  }, [sim]);

  if (callouts.length === 0) return null;
  return (
    <div className="announce">
      {callouts.map((c) => (
        <div key={c.id} className={`announce-item announce-${c.kind}`} style={{ color: c.color }}>
          <span className="announce-text">{c.text}</span>
          <span className="announce-sub">{c.sub}</span>
        </div>
      ))}
    </div>
  );
}
