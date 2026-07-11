/**
 * CombatSystem — attacks, hitboxes, knockback and passives.
 *
 * Damage accumulates as a percentage; knockback grows with that percentage so
 * a fighter is progressively easier to launch off the stage. There are no
 * health bars — the only way to score is to send an opponent across a blast
 * zone. This mirrors the platform-fighter feel called for in the design.
 */
import type { AttackData, AttackKind } from '@/core/types';
import {
  COMBO_RESET_TIME,
  HITSTUN_PER_KNOCKBACK,
  KNOCKBACK_DAMAGE_SCALE,
} from '@/core/constants';
import { clamp, dist } from '@/core/math';
import { debug } from '@/core/debug';
import type { EventBus } from '@/systems/simulation/events';
import {
  effectiveReach,
  isBusy,
  type ActiveAttack,
  type FighterRuntime,
} from '@/systems/simulation/FighterRuntime';

/** Attempt to begin an attack of the given kind. Returns true if it started. */
export function tryStartAttack(f: FighterRuntime, kind: AttackKind): boolean {
  if (isBusy(f) || f.shielding) return false;
  const data = f.config.attacks[kind];
  const cd = f.cooldowns[data.name] ?? 0;
  if (cd > 0) return false;
  if (kind === 'ultimate' && f.ultCharge < 1) return false;

  f.attack = { data, elapsed: 0, hitIds: new Set() };
  f.state = kind;
  f.stateTime = 0;
  if (data.cooldown > 0) f.cooldowns[data.name] = data.cooldown;
  if (kind === 'ultimate') f.ultCharge = 0;

  // Small forward lunge on committal moves gives attacks weight.
  if (kind === 'heavy' || kind === 'special') {
    f.vel.x += f.facing * 2.4;
  }
  if (kind === 'ultimate') {
    f.vel.x += f.facing * 3.5;
    if (f.config.attacks.ultimate.angle > Math.PI * 0.4 || f.config.id === 'lenni') {
      // Skyward launch for divekick-style ultimates (e.g. Lenni's Kloten Kick).
      f.vel.y += 6;
    }
  }
  return true;
}

/** Advance an active attack's timeline. Returns true while its hitbox is live. */
export function attackHitboxActive(attack: ActiveAttack): boolean {
  const { startup, active } = attack.data;
  return attack.elapsed >= startup && attack.elapsed < startup + active;
}

/** Advance timers and clear the attack when its recovery finishes. */
export function updateAttack(f: FighterRuntime, dt: number): void {
  if (!f.attack) return;
  f.attack.elapsed += dt;
  const { startup, active, recovery } = f.attack.data;
  if (f.attack.elapsed >= startup + active + recovery) {
    f.attack = null;
    f.state = f.grounded ? 'idle' : 'fall';
    f.stateTime = 0;
  }
}

/** Compute knockback magnitude for a hit, factoring damage and weight. */
function knockbackMagnitude(attack: AttackData, victim: FighterRuntime): number {
  const stats = victim.config.stats;
  // Classic formula: base + scaling * (damage feeds growth), divided by weight.
  const damageFactor = 1 + (victim.damage / 100) * KNOCKBACK_DAMAGE_SCALE;
  let kb =
    (attack.baseKnockback + attack.knockbackScaling * victim.damage) * damageFactor;
  kb /= stats.weight;
  // Passive + stat knockback resistance.
  kb *= 1 - clamp(stats.knockbackResist, 0, 0.7);
  return kb;
}

/**
 * Resolve one attacker's active hitbox against all potential victims.
 * Applies damage, knockback, hitstun, passives and emits events.
 */
export function resolveAttackHits(
  attacker: FighterRuntime,
  others: FighterRuntime[],
  events: EventBus,
): void {
  const attack = attacker.attack;
  if (!attack || !attackHitboxActive(attack)) return;

  const reach = effectiveReach(attacker, attack.data);
  const hbx = attacker.pos.x + attacker.facing * reach;
  const hby = attacker.pos.y + attack.data.yOffset;

  for (const victim of others) {
    if (victim === attacker || victim.eliminated || victim.respawnTimer > 0) continue;
    if (attack.hitIds.has(victim.config.id)) continue;
    if (victim.invuln > 0) continue;

    const d = dist({ x: hbx, y: hby }, victim.pos);
    if (d > attack.data.radius + 0.5) continue;

    attack.hitIds.add(victim.config.id);

    // Shielding absorbs the hit but drains the shield.
    if (victim.shielding && victim.shield > 0) {
      victim.shield = clamp(victim.shield - attack.data.damage * 0.05, 0, 1);
      events.emit({ type: 'shield', pos: { ...victim.pos } });
      if (victim.shield > 0) continue;
    }

    applyHit(attacker, victim, attack.data, events);
  }
}

/** Apply a confirmed hit from attacker to victim. */
function applyHit(
  attacker: FighterRuntime,
  victim: FighterRuntime,
  attack: AttackData,
  events: EventBus,
): void {
  // --- Damage, with attacker strength and passives -----------------------
  let damage = attack.damage * attacker.config.stats.strength;

  // Robin: combo damage grows with combo length.
  if (attacker.config.passive === 'comboGrowth') {
    damage *= 1 + Math.min(attacker.comboCount, 8) * 0.05;
  }

  victim.damage = clamp(victim.damage + damage, 0, 999);
  // Lifetime stats for post-match balance data — never reset by respawn.
  attacker.totalDamageDealt += damage;
  victim.totalDamageTaken += damage;
  victim.lastHitBy = attacker.config.id;

  // --- Knockback ---------------------------------------------------------
  let kb = knockbackMagnitude(attack, victim);

  // Lenni: precision hits (heavy/special that connect cleanly) hit harder.
  if (attacker.config.passive === 'precision' && (attack.kind === 'heavy' || attack.kind === 'special')) {
    kb *= 1.18;
  }
  // Erim: counter-hitting a fighter who is mid-attack adds knockback.
  if (attacker.config.passive === 'counterForce' && victim.attack) {
    kb *= 1.25;
  }
  // Debug: global knockback scaling.
  kb *= debug.knockbackScale;

  victim.hitFlash = 0.18;
  victim.wasHitRecently = 0.4;

  // Immovable training dummies register damage but never launch or flinch.
  if (victim.immovable) {
    events.emit({
      type: 'hit',
      pos: { ...victim.pos },
      power: kb,
      attackerId: attacker.config.id,
      victimId: victim.config.id,
    });
    attacker.comboCount += 1;
    attacker.comboTimer = COMBO_RESET_TIME;
    attacker.ultCharge = clamp(attacker.ultCharge + damage * 0.012, 0, 1);
    return;
  }

  const angle = attack.angle;
  victim.vel.x = attacker.facing * Math.cos(angle) * kb;
  victim.vel.y = Math.sin(angle) * kb;

  // --- Hitstun -----------------------------------------------------------
  let hitstun = kb * HITSTUN_PER_KNOCKBACK * attack.hitstun;
  // Tusya: heavy attacks briefly stun regardless of knockback.
  if (attacker.config.passive === 'heavyStun' && attack.kind === 'heavy') {
    hitstun += 0.25;
  }
  victim.hitstun = Math.max(victim.hitstun, hitstun);
  victim.state = kb > 9 ? 'knockback' : 'hit';
  victim.stateTime = 0;
  victim.grounded = false;
  victim.attack = null;

  // --- Combo tracking (attacker builds combos, feeds ult charge) ---------
  attacker.comboCount += 1;
  attacker.comboTimer = COMBO_RESET_TIME;
  attacker.ultCharge = clamp(attacker.ultCharge + damage * 0.012, 0, 1);
  // The victim also charges a little ult meter from taking damage (comeback).
  victim.ultCharge = clamp(victim.ultCharge + damage * 0.006, 0, 1);

  events.emit({
    type: 'hit',
    pos: { ...victim.pos },
    power: kb,
    attackerId: attacker.config.id,
    victimId: victim.config.id,
  });
}

/** Tick combo decay each step. */
export function updateCombo(f: FighterRuntime, dt: number): void {
  if (f.comboTimer > 0) {
    f.comboTimer -= dt;
    if (f.comboTimer <= 0) f.comboCount = 0;
  }
}
