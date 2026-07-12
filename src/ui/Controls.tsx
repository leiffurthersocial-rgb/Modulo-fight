/**
 * Controls — reusable control-scheme display components.
 *
 * Reads the player's *effective* bindings (defaults + any custom remaps from
 * Settings) so the menu cards, pause screen and in-game legend always show the
 * key that will actually work — never a stale default after a remap.
 */
import { useMemo } from 'react';
import { resolveBindings, useSettings } from '@/state/settingsStore';
import type { Action } from '@/systems/input/KeyboardController';

/** Turn a KeyboardEvent.code into a short, readable label. */
export function codeLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return code.slice(5);
  // Strip Left/Right on modifier keys and shorten Control → Ctrl.
  const modifier = code.replace(/(Left|Right)$/, '');
  if (modifier === 'Shift' || modifier === 'Alt' || modifier === 'Meta') return modifier;
  if (modifier === 'Control') return 'Ctrl';
  return code;
}

/** Resolve the primary (first) key label for an action from live settings. */
function usePrimaryKey(): (action: Action) => string {
  const overrides = useSettings((s) => s.keyOverrides);
  const bindings = useMemo(() => resolveBindings(overrides), [overrides]);
  return (action: Action) => codeLabel(bindings[action][0]);
}

interface ControlEntry {
  action: string;
  keys: string[];
}

function Keys({ keys }: { keys: string[] }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {keys.map((k, i) => (
        <span key={i} className="kbd">
          {k}
        </span>
      ))}
    </span>
  );
}

/** A full, grouped controls card for menus and the pause screen. */
export function ControlsCard() {
  const key = usePrimaryKey();
  const groups: { title: string; entries: ControlEntry[] }[] = [
    {
      title: 'Move',
      entries: [
        { action: 'Move', keys: [key('up'), key('left'), key('down'), key('right')] },
        { action: 'Jump / Double Jump', keys: [key('jump')] },
        { action: 'Sprint', keys: [key('sprint')] },
        { action: 'Dash', keys: [key('dash')] },
        { action: 'Dodge', keys: [key('dodge')] },
      ],
    },
    {
      title: 'Fight',
      entries: [
        { action: 'Light Attack', keys: [key('light')] },
        { action: 'Heavy Attack', keys: [key('heavy')] },
        { action: 'Special', keys: [key('special')] },
        { action: 'Ultimate', keys: [key('ultimate')] },
        { action: 'Shield', keys: [key('shield')] },
      ],
    },
    {
      title: 'System',
      entries: [{ action: 'Pause', keys: [key('pause')] }],
    },
  ];

  return (
    <div className="controls-card">
      {groups.map((group) => (
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
  const key = usePrimaryKey();
  const entries: ControlEntry[] = [
    { action: 'Move', keys: [key('up'), key('left'), key('down'), key('right')] },
    { action: 'Jump', keys: [key('jump')] },
    { action: 'Light / Heavy', keys: [key('light'), key('heavy')] },
    { action: 'Special / Ult', keys: [key('special'), key('ultimate')] },
    { action: 'Dash / Dodge', keys: [key('dash'), key('dodge')] },
    { action: 'Shield', keys: [key('shield')] },
    { action: 'Pause', keys: [key('pause')] },
  ];

  return (
    <div className="controls-legend">
      <div className="cl-title">Controls</div>
      {entries.map((e) => (
        <div key={e.action} className="cl-row">
          <span>{e.action}</span>
          <span className="cl-key">{e.keys.join(' ')}</span>
        </div>
      ))}
    </div>
  );
}
