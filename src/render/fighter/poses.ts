/**
 * Procedural animation poses.
 *
 * Fighters are posed procedurally from their simulation state — no skeletal
 * animation assets required. This covers every required animation (idle, walk,
 * run, jump, double-jump, fall, land, attacks, hit, knockback, victory,
 * defeat) and is fully deterministic and cheap.
 *
 * Attacks are animated by *style* (punch, kick, spin, slam, dive, …) derived
 * from each move, so a jab, a roundhouse, a ground slam and a divekick all look
 * distinct — even across the four attack slots and across fighters.
 */
import type { AttackData, FighterState } from '@/core/types';

export interface Pose {
  bodyY: number;
  bodyTilt: number;
  bodyRotY: number;
  /** Forward/backward pitch (X axis) — used for rolls, dives and tumbles. */
  bodyRotX: number;
  armLeft: number;
  armRight: number;
  legLeft: number;
  legRight: number;
  headTilt: number;
  /** Squash/stretch scale applied to the whole body. */
  squash: number;
}

export type AttackStyle =
  | 'punch'
  | 'kick'
  | 'spin'
  | 'slam'
  | 'dive'
  | 'barrage'
  | 'charge'
  | 'uppercut'
  | 'lunge';

const IDLE: Pose = {
  bodyY: 0,
  bodyTilt: 0,
  bodyRotY: 0,
  bodyRotX: 0,
  armLeft: 0.1,
  armRight: -0.1,
  legLeft: 0,
  legRight: 0,
  headTilt: 0,
  squash: 1,
};

/** Map a move to an animation style using its name and category. */
export function deriveAttackStyle(attack: AttackData): AttackStyle {
  const n = attack.name.toLowerCase();
  if (/(kick|dive|kloten|flying|sky)/.test(n)) {
    return /(dive|kloten|sky|meteor)/.test(n) ? 'dive' : 'kick';
  }
  if (/(spin|roundhouse|cyclone|hurricane)/.test(n)) return 'spin';
  if (/(slam|sledge|earthquake|ground|meteor)/.test(n)) return 'slam';
  if (/(rapid|punches|barrage|laser)/.test(n)) return 'barrage';
  if (/(charge)/.test(n)) return 'charge';
  if (/(rush|golden|dash|strike)/.test(n)) return 'lunge';
  if (/(cross|uppercut|rising)/.test(n)) return 'uppercut';
  // Fall back on the attack category.
  if (attack.kind === 'heavy') return 'uppercut';
  return 'punch';
}

/** Pose an attack of a given style. `p` progresses 0→1 over the whole move. */
function attackPose(style: AttackStyle, p: number, time: number, facing: number): Pose {
  const o: Pose = { ...IDLE, armLeft: 0, armRight: 0 };
  // Three clear phases so every attack reads as wind-up → strike → recover.
  const wind = Math.min(p / 0.3, 1); // 0→1 over the first 30%
  const strike = clamp01((p - 0.3) / 0.35); // 0→1 over the active window
  const recover = clamp01((p - 0.65) / 0.35); // 0→1 during recovery
  // A crisp 0→1→0 impulse peaking at the moment of impact.
  const hit = Math.sin(clamp01((p - 0.25) / 0.5) * Math.PI);

  switch (style) {
    case 'punch':
      // Cock the fist back, then drive it fully forward with a hip turn.
      o.armRight = 0.7 * wind - 2.4 * strike + 1.0 * recover;
      o.armLeft = -0.2 - 0.5 * strike;
      o.bodyRotY = -0.3 * wind + 0.5 * strike;
      o.bodyTilt = 0.22 * hit;
      break;
    case 'uppercut':
      // Crouch and load, then a big scooping rising fist.
      o.armRight = 0.9 * wind - 3.1 * strike + 1.2 * recover;
      o.armLeft = -0.6 * strike;
      o.bodyY = -0.12 * wind + 0.22 * strike;
      o.bodyTilt = 0.15 * wind - 0.3 * strike;
      o.squash = 1 - 0.12 * wind + 0.14 * strike;
      break;
    case 'kick':
      // Chamber the knee, then snap the leg out horizontally.
      o.legRight = 0.6 * wind - 2.6 * strike + 1.0 * recover;
      o.legLeft = 0.35 * strike;
      o.armLeft = 1.3 * hit;
      o.armRight = -0.8 * hit;
      o.bodyTilt = 0.4 * hit;
      break;
    case 'spin':
      // A full whirling rotation with arms flung wide.
      o.bodyRotY = facing * p * Math.PI * 2;
      o.armLeft = 1.9 * Math.sin(p * Math.PI * 2);
      o.armRight = -1.9 * Math.sin(p * Math.PI * 2);
      o.legRight = -1.0 * hit;
      o.bodyTilt = 0.2;
      break;
    case 'slam':
      // Both arms raised high overhead, then a full-body smash down.
      o.armLeft = -2.8 * wind + 2.5 * strike;
      o.armRight = -2.8 * wind + 2.5 * strike;
      o.bodyY = 0.28 * wind - 0.32 * strike;
      o.bodyTilt = 0.12 * strike;
      o.squash = 1 + 0.12 * wind - 0.22 * strike;
      break;
    case 'dive':
      // Coil up, then pitch head-first into a committed diving kick.
      o.legRight = -1.4 * wind + 2.0 * strike;
      o.legLeft = -1.4 * wind + 0.5 * strike;
      o.armLeft = -2.0 + 1.2 * strike;
      o.armRight = -2.0 + 1.2 * strike;
      o.bodyTilt = 0.25 + 0.6 * strike;
      o.bodyRotX = 0.85 * strike;
      o.bodyRotY = facing * strike * Math.PI * 0.45;
      break;
    case 'barrage': {
      // A machine-gun flurry of alternating straight punches.
      const osc = Math.sin(time * 46);
      o.armRight = -1.7 - osc * 0.5;
      o.armLeft = -1.7 + osc * 0.5;
      o.bodyRotY = osc * 0.2;
      o.bodyTilt = 0.14;
      break;
    }
    case 'charge':
      // A long, heavy wind-up, then one thunderous forward drive.
      o.armRight = 1.1 * wind - 2.8 * strike + 1.2 * recover;
      o.armLeft = 0.5 * wind - 0.3 * strike;
      o.bodyTilt = -0.35 * wind + 0.5 * strike;
      o.bodyY = -0.08 * wind;
      o.squash = 1 + 0.1 * wind;
      break;
    case 'lunge':
    default:
      // A dashing shoulder-forward strike with a wide stance.
      o.armRight = -2.2 * hit;
      o.armLeft = -0.6 * hit;
      o.legLeft = -0.8 * hit;
      o.legRight = 0.8 * hit;
      o.bodyTilt = 0.5 * hit;
      break;
  }
  return o;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function computePose(
  state: FighterState,
  time: number,
  speed: number,
  attackProgress: number,
  style: AttackStyle,
  facing: number,
): Pose {
  // Attack states dispatch to the style-based animator.
  if (state === 'light' || state === 'heavy' || state === 'special' || state === 'ultimate') {
    const pose = attackPose(style, attackProgress, time, facing);
    // Ultimates get extra flourish on top of their style.
    if (state === 'ultimate') {
      pose.bodyY += Math.sin(attackProgress * Math.PI) * 0.15;
      pose.squash = Math.max(pose.squash, 1 + Math.sin(attackProgress * Math.PI) * 0.08);
    }
    return pose;
  }

  const p: Pose = { ...IDLE };
  switch (state) {
    case 'idle': {
      // Gentle breathing with a slow, lifelike weight-shift sway.
      const b = Math.sin(time * 2.4);
      p.bodyY = b * 0.035;
      p.armLeft = 0.16 + b * 0.06;
      p.armRight = -0.16 - b * 0.06;
      p.headTilt = Math.sin(time * 1.6) * 0.05;
      p.bodyTilt = Math.sin(time * 1.2) * 0.03;
      break;
    }
    case 'walk': {
      const s = Math.sin(time * 9) * 0.7;
      p.armLeft = s;
      p.armRight = -s;
      p.legLeft = -s;
      p.legRight = s;
      p.bodyY = Math.abs(Math.sin(time * 9)) * 0.07;
      p.bodyTilt = 0.08;
      break;
    }
    case 'run': {
      const s = Math.sin(time * 15) * 1.25;
      p.armLeft = s;
      p.armRight = -s;
      p.legLeft = -s;
      p.legRight = s;
      p.bodyTilt = 0.36;
      p.headTilt = 0.08;
      p.bodyY = Math.abs(Math.sin(time * 15)) * 0.12;
      break;
    }
    case 'jump':
      p.armLeft = -1.4;
      p.armRight = -1.4;
      p.legLeft = 0.5;
      p.legRight = 0.8;
      p.squash = 1.08;
      break;
    case 'doubleJump':
      p.bodyRotY = Math.min(time * 14, Math.PI * 2);
      p.armLeft = -1.8;
      p.armRight = -1.8;
      p.legLeft = 0.9;
      p.legRight = 0.9;
      break;
    case 'fall':
      p.armLeft = -0.6 + Math.sin(time * 6) * 0.2;
      p.armRight = -0.6 - Math.sin(time * 6) * 0.2;
      p.legLeft = 0.3;
      p.legRight = -0.3;
      break;
    case 'land':
      p.squash = 0.82;
      p.legLeft = 0.4;
      p.legRight = 0.4;
      p.armLeft = 0.5;
      p.armRight = -0.5;
      break;
    case 'dash':
      p.bodyTilt = 0.5;
      p.armLeft = 1.2;
      p.armRight = 1.2;
      p.legLeft = -0.6;
      p.legRight = 0.6;
      break;
    case 'dodge':
      // A committed forward roll: tuck tight and somersault once.
      p.squash = 0.72;
      p.bodyY = -0.18;
      p.bodyRotX = Math.min(time * 17.5, Math.PI * 2);
      p.armLeft = -1.2;
      p.armRight = -1.2;
      p.legLeft = 1.1;
      p.legRight = 1.1;
      p.headTilt = 0.3;
      break;
    case 'shield':
      // Guarded cower: arms crossed high, crouched and braced.
      p.armLeft = -1.1;
      p.armRight = -1.1;
      p.bodyY = -0.1;
      p.squash = 0.92;
      p.bodyTilt = 0.1;
      p.headTilt = -0.12;
      break;
    case 'hit':
      p.bodyTilt = -0.5;
      p.armLeft = -1.1 + Math.sin(time * 34) * 0.35;
      p.armRight = -1.1 - Math.sin(time * 34) * 0.35;
      p.headTilt = -0.36;
      p.squash = 0.96;
      break;
    case 'knockback':
      // A fast, flailing tumble that sells being launched.
      p.bodyRotY = time * 13;
      p.bodyRotX = Math.sin(time * 9) * 0.45;
      p.bodyTilt = -0.7;
      p.armLeft = -1.8 + Math.sin(time * 24) * 0.45;
      p.armRight = -1.8 - Math.sin(time * 24) * 0.45;
      p.legLeft = -0.9 + Math.sin(time * 20) * 0.3;
      p.legRight = -0.6 - Math.sin(time * 20) * 0.3;
      break;
    case 'victory': {
      // Alternating fist pumps with a bounce — a real celebration.
      const beat = Math.sin(time * 6);
      p.armLeft = -2.2 + Math.max(0, beat) * 0.7;
      p.armRight = -2.2 + Math.max(0, -beat) * 0.7;
      p.bodyY = Math.abs(Math.sin(time * 6)) * 0.18;
      p.bodyRotY = Math.sin(time * 3) * 0.2;
      p.headTilt = Math.sin(time * 6) * 0.08;
      break;
    }
    case 'defeat':
      // Slumped kneel: sunk low, head hung, arms limp.
      p.bodyY = -0.3;
      p.squash = 0.9;
      p.legLeft = 1.3;
      p.legRight = 1.3;
      p.bodyTilt = 0.35;
      p.bodyRotX = 0.25;
      p.headTilt = 0.5;
      p.armLeft = 0.25;
      p.armRight = 0.25;
      break;
  }
  void speed;
  return p;
}
