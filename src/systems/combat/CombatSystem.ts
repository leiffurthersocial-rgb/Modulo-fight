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
  VICTIM_BODY_RADIUS,
} from '@/core/constants';
import { clamp, segmentPointDistance } from '@/core/math';
import { debug } from '@/core/debug';
import type { EventBus } from '@/systems/simulation/events';
import type { AttackData as _AttackData } from '@/core/types';
import {
  effectiveReach,
  isBusy,
  type ActiveAttack,
  type FighterRuntime,
} from '@/systems/simulation/FighterRuntime';

/**
 * True when the victim is protected from this hit by invulnerability. A move
 * flagged `piercesInvuln` cuts through *dodge* invulnerability (short windows,
 * ≤ 0.4s) so it can't be rolled through — but never through the long spawn
 * invulnerability, so respawns stay safe.
 */
function isInvulnerableTo(victim: FighterRuntime, attack: _AttackData): boolean {
  if (victim.invuln <= 0) return false;
  if (attack.piercesInvuln && victim.invuln <= 0.4) return false;
  return true;
}

/** Attempt to begin an attack of the given kind. Returns true if it started. */
export function tryStartAttack(f: FighterRuntime, kind: AttackKind): boolean {
  if (isBusy(f) || f.shielding) return false;
  const data = f.config.attacks[kind];
  const cd = f.cooldowns[data.name] ?? 0;
  if (cd > 0) return false;
  if (kind === 'ultimate' && f.ultCharge < 1) return false;

  f.attack = { data, elapsed: 0, hitLog: new Map(), fired: 0 };
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
    if (
      f.config.attacks.ultimate.angle > Math.PI * 0.4 ||
      f.config.attacks.ultimate.skyhunt ||
      f.config.id === 'lenni'
    ) {
      // Skyward launch for divekick-style ultimates (e.g. Lenni's Kloten Kick)
      // and sky-hunts (Emir leaps to rake the air).
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
  dt: number,
): void {
  const attack = attacker.attack;
  if (!attack || !attackHitboxActive(attack)) return;

  // Vacuum ultimates (Leif's Hurricane Combo) drag nearby foes into the
  // whirlwind while the hitbox is live, so the multi-hit actually traps.
  if (attack.data.vacuum) {
    for (const victim of others) {
      if (victim === attacker || victim.eliminated || victim.respawnTimer > 0) continue;
      if (victim.invuln > 0 || victim.immovable) continue;
      const dx = attacker.pos.x - victim.pos.x;
      if (Math.abs(dx) < 5 && Math.abs(dx) > 0.3) {
        victim.vel.x += Math.sign(dx) * 26 * dt;
      }
    }
  }

  // Seismic ultimates (Leonidas's Earthquake) strike every grounded opponent
  // anywhere on the stage — the only escape is to be airborne.
  if (attack.data.quake) {
    for (const victim of others) {
      if (victim === attacker || victim.eliminated || victim.respawnTimer > 0) continue;
      if (attack.hitLog.has(victim.config.id)) continue;
      if (isInvulnerableTo(victim, attack.data) || !victim.grounded) continue;
      attack.hitLog.set(victim.config.id, attack.elapsed);
      applyHit(attacker, victim, attack.data, events);
    }
    return; // The quake IS the hitbox — skip the melee capsule.
  }

  // Sky-hunt ultimates (Emir's Skyfall) are the exact mirror: they rake the
  // whole sky, striking every *airborne* opponent at any distance. Staying
  // grounded is the only way out.
  if (attack.data.skyhunt) {
    for (const victim of others) {
      if (victim === attacker || victim.eliminated || victim.respawnTimer > 0) continue;
      if (attack.hitLog.has(victim.config.id)) continue;
      if (isInvulnerableTo(victim, attack.data) || victim.grounded) continue;
      attack.hitLog.set(victim.config.id, attack.elapsed);
      applyHit(attacker, victim, attack.data, events);
    }
    return; // The sky rake IS the hitbox — skip the melee capsule.
  }

  const reach = effectiveReach(attacker, attack.data);
  // Swept-capsule hitbox: a segment from just in front of the torso out to the
  // attack's reach tip, thickened by the move's radius. Testing the whole
  // segment (not one sampled point) means a move connects along its entire
  // extent, so attacks that visually clip the opponent reliably register.
  const yc = attacker.pos.y + attack.data.yOffset;
  const origin = { x: attacker.pos.x + attacker.facing * 0.2, y: yc };
  const tip = { x: attacker.pos.x + attacker.facing * reach, y: yc };

  const interval = attack.data.hitInterval;
  for (const victim of others) {
    if (victim === attacker || victim.eliminated || victim.respawnTimer > 0) continue;
    // Multi-hit moves re-strike the same target every `hitInterval`; single-hit
    // moves connect at most once per swing.
    const last = attack.hitLog.get(victim.config.id);
    if (last !== undefined) {
      if (interval === undefined) continue;
      if (attack.elapsed - last < interval) continue;
    }
    if (isInvulnerableTo(victim, attack.data)) continue;

    const d = segmentPointDistance(victim.pos, origin, tip);
    if (d > attack.data.radius + VICTIM_BODY_RADIUS) continue;

    attack.hitLog.set(victim.config.id, attack.elapsed);

    // Shielding absorbs the hit but drains the shield.
    if (victim.shielding && victim.shield > 0) {
      if (!(debug.infiniteShield && victim.isPlayer)) {
        victim.shield = clamp(victim.shield - attack.data.damage * 0.05, 0, 1);
      }
      events.emit({ type: 'shield', pos: { ...victim.pos } });
      if (victim.shield > 0) continue;
    }

    applyHit(attacker, victim, attack.data, events);
  }
}

/** Apply a confirmed hit from attacker to victim (also used by projectiles). */
export function applyHit(
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
  // Erim: counter-hit — striking a foe who is mid-attack rewards patience with
  // bonus damage (and bonus knockback below).
  const counterHit = attacker.config.passive === 'counterForce' && !!victim.attack;
  if (counterHit) damage *= 1.2;
  // Emir: an opponent with no ground under them is prey — juggles and
  // edgeguards bite harder (bonus knockback applied below too).
  const airborneHit = attacker.config.passive === 'aerialHunter' && !victim.grounded;
  if (airborneHit) damage *= 1.18;

  victim.damage = clamp(victim.damage + damage, 0, 999);
  // Lifetime stats for post-match balance data — never reset by respawn.
  attacker.totalDamageDealt += damage;
  victim.totalDamageTaken += damage;
  victim.lastHitBy = attacker.config.id;

  // Syphon: the move drains a fraction of the damage dealt, reducing the
  // attacker's own %. Capped per hit so it's sustain, never a full reset.
  if (attack.syphon && attacker.damage > 0) {
    const heal = Math.min(damage * attack.syphon, 8, attacker.damage);
    if (heal > 0.1) {
      attacker.damage = clamp(attacker.damage - heal, 0, 999);
      events.emit({
        type: 'syphon',
        pos: { ...attacker.pos },
        amount: heal,
        fighterId: attacker.config.id,
      });
    }
  }

  // --- Knockback ---------------------------------------------------------
  let kb = knockbackMagnitude(attack, victim);

  // Lenni: precision hits (heavy/special that connect cleanly) hit harder.
  if (attacker.config.passive === 'precision' && (attack.kind === 'heavy' || attack.kind === 'special')) {
    kb *= 1.18;
  }
  // Erim: counter-hitting a fighter who is mid-attack adds knockback.
  if (counterHit) {
    kb *= 1.32;
  }
  // Emir: airborne victims get launched considerably further — once he puts you
  // off the ground, every follow-up carries you closer to the blast zone.
  if (airborneHit) {
    kb *= 1.3;
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
    attacker.ultCharge = clamp(attacker.ultCharge + damage * 0.012 * (attacker.config.ultChargeRate ?? 1), 0, 1);
    return;
  }

  // Curse hits (Jovan's Glorious Strike): full damage, zero launch. The
  // victim keeps their footing — and every point of that damage.
  if (attack.noKnockback) {
    victim.hitstun = Math.max(victim.hitstun, 0.45);
    victim.state = 'hit';
    victim.stateTime = 0;
    victim.attack = null;
    attacker.comboCount += 1;
    attacker.comboTimer = COMBO_RESET_TIME;
    attacker.ultCharge = clamp(attacker.ultCharge + damage * 0.012 * (attacker.config.ultChargeRate ?? 1), 0, 1);
    victim.ultCharge = clamp(victim.ultCharge + damage * 0.006, 0, 1);
    events.emit({
      type: 'hit',
      pos: { ...victim.pos },
      power: kb,
      attackerId: attacker.config.id,
      victimId: victim.config.id,
    });
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
  attacker.ultCharge = clamp(attacker.ultCharge + damage * 0.012 * (attacker.config.ultChargeRate ?? 1), 0, 1);
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
