/**
 * Controls — single source of truth for the control scheme plus reusable
 * display components (a menu card and an in-game legend). Keeping the mapping
 * here means the menus, pause screen and HUD legend never disagree.
 */

export interface ControlEntry {
  action: string;
  keys: string[];
}

/** Grouped controls for clear presentation. */
export const CONTROL_GROUPS: { title: string; entries: ControlEntry[] }[] = [
  {
    title: 'Move',
    entries: [
      { action: 'Move', keys: ['W', 'A', 'S', 'D'] },
      { action: 'Jump / Double Jump', keys: ['Space'] },
      { action: 'Sprint', keys: ['Shift'] },
      { action: 'Dash', keys: ['I'] },
      { action: 'Dodge', keys: ['H'] },
    ],
  },
  {
    title: 'Fight',
    entries: [
      { action: 'Light Attack', keys: ['J'] },
      { action: 'Heavy Attack', keys: ['K'] },
      { action: 'Special', keys: ['L'] },
      { action: 'Ultimate', keys: ['U'] },
      { action: 'Shield', keys: ['G'] },
    ],
  },
  {
    title: 'System',
    entries: [{ action: 'Pause', keys: ['P'] }],
  },
];

/** Compact key list used in the in-game legend. */
export const QUICK_LEGEND: ControlEntry[] = [
  { action: 'Move', keys: ['W', 'A', 'S', 'D'] },
  { action: 'Jump', keys: ['Space'] },
  { action: 'Light / Heavy', keys: ['J', 'K'] },
  { action: 'Special / Ult', keys: ['L', 'U'] },
  { action: 'Dash / Dodge', keys: ['I', 'H'] },
  { action: 'Shield', keys: ['G'] },
  { action: 'Pause', keys: ['P'] },
];

function Keys({ keys }: { keys: string[] }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {keys.map((k) => (
        <span key={k} className="kbd">
          {k}
        </span>
      ))}
    </span>
  );
}

/** A full, grouped controls card for menus and the pause screen. */
export function ControlsCard() {
  return (
    <div className="controls-card">
      {CONTROL_GROUPS.map((group) => (
        <div key={group.title} className="controls-group">
          <div className="controls-group-title">{group.title}</div>
          {group.entries.map((e) => (
            <div key={e.action} className="controls-card-row">
              <span>{e.action}</span>
              <Keys keys={e.keys} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** A small always-visible legend shown during a match. */
export function ControlsLegend() {
  return (
    <div className="controls-legend">
      <div className="cl-title">Controls</div>
      {QUICK_LEGEND.map((e) => (
        <div key={e.action} className="cl-row">
          <span>{e.action}</span>
          <span className="cl-key">{e.keys.join(' ')}</span>
        </div>
      ))}
    </div>
  );
}
