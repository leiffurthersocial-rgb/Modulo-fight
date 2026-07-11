/**
 * ArenaView — resolves an arena to its renderer.
 *
 * Every stage is drawn by the single data-driven `ThemedArena`, which reads the
 * arena's platforms + theme. A per-id override map is kept for any stage that
 * ever needs fully bespoke geometry beyond the themed system.
 */
import type { ArenaConfig } from '@/core/types';
import { ThemedArena } from './ThemedArena';

interface ArenaRendererProps {
  arena: ArenaConfig;
  effectsScale?: number;
}

const OVERRIDES: Record<string, (props: ArenaRendererProps) => JSX.Element> = {};

export function ArenaView({ arena, effectsScale = 1 }: ArenaRendererProps) {
  const Renderer = OVERRIDES[arena.id] ?? ThemedArena;
  return <Renderer arena={arena} effectsScale={effectsScale} />;
}
