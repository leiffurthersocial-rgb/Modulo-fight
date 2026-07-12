/**
 * StatBars — a visual, comparative stat display for a fighter.
 *
 * Each stat is normalised across the whole roster so the bars answer the real
 * question ("is this fighter fast/heavy/strong *relative to everyone else*?")
 * rather than showing raw units. Every stat gets its own colour and a 1–10
 * rating badge for at-a-glance reading.
 */
import { useMemo } from 'react';
import type { FighterConfig } from '@/core/types';
import { FIGHTERS } from '@/fighters/fighterData';

interface StatDef {
  label: string;
  color: string;
  get: (f: FighterConfig) => number;
}

const STAT_DEFS: StatDef[] = [
  { label: 'Speed', color: '#38d0ff', get: (f) => f.stats.speed },
  { label: 'Weight', color: '#ffb03c', get: (f) => f.stats.weight },
  { label: 'Power', color: '#ff5d73', get: (f) => f.stats.strength },
  { label: 'Jump', color: '#8affc1', get: (f) => f.stats.jumpHeight },
  {
    label: 'Air',
    color: '#6affea',
    // Air game = manoeuvrability + floatiness + extra jumps, all rolled up.
    get: (f) =>
      (f.stats.airControl ?? 1) + (1 - (f.stats.gravityMul ?? 1)) + f.extraJumps * 0.15,
  },
  { label: 'Defense', color: '#b58cff', get: (f) => f.stats.knockbackResist },
];

/** Precompute roster-wide min/max for each stat (module-level, computed once). */
const RANGES = STAT_DEFS.map((def) => {
  const values = FIGHTERS.map(def.get);
  return { min: Math.min(...values), max: Math.max(...values) };
});

export function StatBars({ fighter }: { fighter: FighterConfig }) {
  const rows = useMemo(
    () =>
      STAT_DEFS.map((def, i) => {
        const range = RANGES[i];
        const span = range.max - range.min || 1;
        const norm = (def.get(fighter) - range.min) / span; // 0..1 across roster
        return {
          label: def.label,
          color: def.color,
          fill: 0.12 + norm * 0.88, // floor so the weakest still shows a sliver
          rating: 1 + Math.round(norm * 9), // 1..10
        };
      }),
    [fighter],
  );

  return (
    <div className="statbars">
      {rows.map((r) => (
        <div key={r.label} className="statbar-row">
          <span className="statbar-label">{r.label}</span>
          <span className="statbar-track">
            <span
              className="statbar-fill"
              style={{ width: `${r.fill * 100}%`, background: r.color }}
            />
          </span>
          <span className="statbar-rating" style={{ color: r.color }}>
            {r.rating}
          </span>
        </div>
      ))}
    </div>
  );
}
