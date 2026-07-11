/**
 * Attack frame-data builders.
 *
 * Rather than hand-writing every field for all 32 attacks, we start from
 * sensible archetype templates and let each fighter override the parts that
 * make them unique. This keeps the data readable and the balance consistent.
 */
import type { AttackData, AttackKind } from '@/core/types';

type Overrides = Partial<Omit<AttackData, 'kind'>>;

const BASE: Record<AttackKind, AttackData> = {
  light: {
    kind: 'light',
    name: 'Jab',
    startup: 0.06,
    active: 0.08,
    recovery: 0.16,
    damage: 4,
    baseKnockback: 3.5,
    knockbackScaling: 0.14,
    angle: Math.PI * 0.12,
    reach: 1.1,
    yOffset: 0.2,
    radius: 0.7,
    hitstun: 1,
    cooldown: 0,
  },
  heavy: {
    kind: 'heavy',
    name: 'Smash',
    startup: 0.16,
    active: 0.1,
    recovery: 0.34,
    damage: 12,
    baseKnockback: 8,
    knockbackScaling: 0.32,
    angle: Math.PI * 0.22,
    reach: 1.3,
    yOffset: 0.25,
    radius: 0.85,
    hitstun: 1.3,
    cooldown: 0,
  },
  special: {
    kind: 'special',
    name: 'Special',
    startup: 0.12,
    active: 0.18,
    recovery: 0.3,
    damage: 9,
    baseKnockback: 6,
    knockbackScaling: 0.26,
    angle: Math.PI * 0.3,
    reach: 1.5,
    yOffset: 0.3,
    radius: 0.9,
    hitstun: 1.4,
    cooldown: 1.4,
  },
  ultimate: {
    kind: 'ultimate',
    name: 'Ultimate',
    startup: 0.22,
    active: 0.24,
    recovery: 0.5,
    damage: 26,
    baseKnockback: 16,
    knockbackScaling: 0.55,
    angle: Math.PI * 0.28,
    reach: 2,
    yOffset: 0.3,
    radius: 1.4,
    hitstun: 1.8,
    cooldown: 12,
  },
};

/** Build an attack of a given archetype with per-fighter overrides. */
export function makeAttack(kind: AttackKind, overrides: Overrides = {}): AttackData {
  return { ...BASE[kind], ...overrides, kind };
}
