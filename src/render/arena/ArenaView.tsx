/**
 * ArenaView — resolves an arena to its renderer.
 *
 * Every stage is drawn by the single data-driven `ThemedArena`, which reads the
 * arena's platforms + theme. A per-id override map is kept for any stage that
 * ever needs fully bespoke geometry beyond the themed system.
 */
import type { ArenaConfig } from '@/core/types';
import { ThemedArena } from './ThemedArena';

const OVERRIDES: Record<string, (props: { arena: ArenaConfig }) => JSX.Element> = {};

export function ArenaView({ arena }: { arena: ArenaConfig }) {
  const Renderer = OVERRIDES[arena.id] ?? ThemedArena;
  return <Renderer arena={arena} />;
}
