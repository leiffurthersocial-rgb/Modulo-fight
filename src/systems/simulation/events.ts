/**
 * Lightweight event bus decoupling the simulation from presentation.
 *
 * The combat/physics systems emit gameplay events; the audio system and the
 * particle system subscribe. Neither presentation layer is referenced by the
 * simulation, which keeps the core testable and swappable.
 */
import type { Vec2 } from '@/core/types';

export type GameEvent =
  | { type: 'hit'; pos: Vec2; power: number; attackerId: string; victimId: string }
  | { type: 'jump'; pos: Vec2 }
  | { type: 'land'; pos: Vec2 }
  | { type: 'attack'; pos: Vec2; kind: string }
  | { type: 'special'; pos: Vec2; fighterId: string }
  | { type: 'ultimate'; pos: Vec2; fighterId: string }
  | { type: 'knockout'; pos: Vec2; victimId: string }
  | { type: 'shield'; pos: Vec2 }
  | { type: 'wave'; wave: number; score: number };

export type GameEventHandler = (e: GameEvent) => void;

export class EventBus {
  private handlers: GameEventHandler[] = [];

  subscribe(handler: GameEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  emit(e: GameEvent): void {
    for (const h of this.handlers) h(e);
  }

  clear(): void {
    this.handlers = [];
  }
}
