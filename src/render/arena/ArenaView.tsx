/**
 * ArenaView — resolves an arena id to its renderer.
 *
 * New arenas register their component here. Unimplemented arenas fall back to
 * Sky Temple's geometry so the game is always playable while new stages are in
 * progress.
 */
import type { ArenaConfig } from '@/core/types';
import { SkyTemple } from './SkyTemple';

const RENDERERS: Record<string, (props: { arena: ArenaConfig }) => JSX.Element> = {
  skyTemple: SkyTemple,
};

export function ArenaView({ arena }: { arena: ArenaConfig }) {
  const Renderer = RENDERERS[arena.id] ?? SkyTemple;
  return <Renderer arena={arena} />;
}
