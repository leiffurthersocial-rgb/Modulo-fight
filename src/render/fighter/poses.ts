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
  const swing = Math.sin(Math.min(p, 1) * Math.PI); // 0→1→0 over the move
  const wind = Math.min(p / 0.35, 1); // wind-up ramp
  const strike = Math.max(0, (p - 0.35) / 0.65); // strike ramp

  switch (style) {
    case 'punch':
      o.armRight = -1.6 * swing - 0.1;
      o.armLeft = 0.3 * swing;
      o.bodyTilt = 0.12 * swing;
      o.bodyRotY = 0.15 * swing;
      break;
    case 'uppercut':
      o.armRight = -0.3 + wind * 0.8 - strike * 3.0; // scoop up
      o.armLeft = -0.4 * strike;
      o.bodyY = strike * 0.15;
      o.bodyTilt = -0.25 * strike;
      o.squash = 1 + strike * 0.12;
      break;
    case 'kick':
      o.legRight = -0.3 + wind * 0.5 - strike * 2.2;
      o.legLeft = 0.3 * strike;
      o.armLeft = 1.0 * swing;
      o.armRight = -0.6 * swing;
      o.bodyTilt = 0.3 * swing;
      break;
    case 'spin':
      o.bodyRotY = p * Math.PI * 2;
      o.armLeft = 1.7 * Math.sin(p * Math.PI * 2);
      o.armRight = -1.7 * Math.sin(p * Math.PI * 2);
      o.legRight = 0.8 * swing;
      o.bodyTilt = 0.15;
      break;
    case 'slam':
      // Raise both arms overhead, then smash down.
      o.armLeft = -2.6 * wind + (2.6 - 0.4) * strike;
      o.armRight = -2.6 * wind + (2.6 - 0.4) * strike;
      o.bodyY = 0.2 * wind - 0.25 * strike;
      o.bodyTilt = 0.1 * strike;
      o.squash = 1 + wind * 0.1 - strike * 0.18;
      break;
    case 'dive':
      // Leap/tuck, then extend into a diving kick.
      o.legRight = -1.2 * wind + 1.6 * strike;
      o.legLeft = -1.2 * wind + 0.4 * strike;
      o.armLeft = -1.8 + strike * 1.0;
      o.armRight = -1.8 + strike * 1.0;
      o.bodyTilt = 0.2 + strike * 0.5;
      o.bodyRotY = strike * Math.PI * 0.4;
      break;
    case 'barrage': {
      // Rapid alternating jabs — fast oscillation across the whole move.
      const osc = Math.sin(time * 42);
      o.armRight = -1.4 - osc * 0.35;
      o.armLeft = -1.4 + osc * 0.35;
      o.bodyTilt = 0.12;
      break;
    }
    case 'charge':
      // Big wind-up, held, then one heavy forward drive.
      o.armRight = -0.2 + wind * 1.0 - strike * 2.4;
      o.armLeft = 0.4 * wind;
      o.bodyTilt = -0.3 * wind + 0.4 * strike;
      o.bodyY = -0.05 * wind;
      o.squash = 1 + wind * 0.08;
      break;
    case 'lunge':
    default:
      o.armRight = -1.9 * swing;
      o.armLeft = -0.5 * swing;
      o.legLeft = -0.6 * swing;
      o.legRight = 0.6 * swing;
      o.bodyTilt = 0.4 * swing;
      break;
  }
  void facing;
  return o;
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
    case 'idle':
      p.bodyY = Math.sin(time * 2.4) * 0.03;
      p.armLeft = 0.15 + Math.sin(time * 2.4) * 0.05;
      p.armRight = -0.15 - Math.sin(time * 2.4) * 0.05;
      p.headTilt = Math.sin(time * 1.6) * 0.04;
      break;
    case 'walk': {
      const s = Math.sin(time * 8) * 0.5;
      p.armLeft = s;
      p.armRight = -s;
      p.legLeft = -s;
      p.legRight = s;
      p.bodyY = Math.abs(Math.sin(time * 8)) * 0.05;
      break;
    }
    case 'run': {
      const s = Math.sin(time * 13) * 0.9;
      p.armLeft = s;
      p.armRight = -s;
      p.legLeft = -s;
      p.legRight = s;
      p.bodyTilt = 0.22;
      p.bodyY = Math.abs(Math.sin(time * 13)) * 0.08;
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
      p.squash = 0.9;
      p.bodyRotY = time * 20;
      p.armLeft = 1;
      p.armRight = 1;
      break;
    case 'shield':
      p.armLeft = -0.9;
      p.armRight = -0.9;
      p.bodyY = -0.05;
      break;
    case 'hit':
      p.bodyTilt = -0.4;
      p.armLeft = -1 + Math.sin(time * 30) * 0.3;
      p.armRight = -1 - Math.sin(time * 30) * 0.3;
      p.headTilt = -0.3;
      break;
    case 'knockback':
      p.bodyRotY = time * 10;
      p.bodyTilt = -0.6;
      p.armLeft = -1.6;
      p.armRight = -1.6;
      p.legLeft = -0.8;
      p.legRight = -0.8;
      break;
    case 'victory':
      p.armLeft = -2.4;
      p.armRight = -2.4;
      p.bodyY = Math.abs(Math.sin(time * 4)) * 0.15;
      break;
    case 'defeat':
      p.bodyTilt = 0.9;
      p.headTilt = 0.4;
      p.armLeft = 0.3;
      p.armRight = 0.3;
      break;
  }
  void speed;
  return p;
}
