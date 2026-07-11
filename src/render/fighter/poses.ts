/**
 * Procedural animation poses.
 *
 * Rather than shipping heavy skeletal animation assets, each fighter is posed
 * procedurally from its simulation state. `computePose` returns limb rotations
 * and body offsets for the current frame, covering every required animation:
 * idle, walk, run, jump, double-jump, fall, land, attacks, hit, knockback,
 * victory and defeat. This is fully deterministic and extremely cheap.
 */
import type { FighterState } from '@/core/types';

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

export function computePose(
  state: FighterState,
  time: number,
  speed: number,
  attackProgress: number,
): Pose {
  const p: Pose = { ...IDLE };

  switch (state) {
    case 'idle': {
      // Gentle breathing bob.
      p.bodyY = Math.sin(time * 2.4) * 0.03;
      p.armLeft = 0.15 + Math.sin(time * 2.4) * 0.05;
      p.armRight = -0.15 - Math.sin(time * 2.4) * 0.05;
      p.headTilt = Math.sin(time * 1.6) * 0.04;
      break;
    }
    case 'walk': {
      const swing = Math.sin(time * 8) * 0.5;
      p.armLeft = swing;
      p.armRight = -swing;
      p.legLeft = -swing;
      p.legRight = swing;
      p.bodyY = Math.abs(Math.sin(time * 8)) * 0.05;
      break;
    }
    case 'run': {
      const swing = Math.sin(time * 13) * 0.9;
      p.armLeft = swing;
      p.armRight = -swing;
      p.legLeft = -swing;
      p.legRight = swing;
      p.bodyTilt = 0.22;
      p.bodyY = Math.abs(Math.sin(time * 13)) * 0.08;
      break;
    }
    case 'jump': {
      p.armLeft = -1.4;
      p.armRight = -1.4;
      p.legLeft = 0.5;
      p.legRight = 0.8;
      p.squash = 1.08;
      break;
    }
    case 'doubleJump': {
      p.bodyRotY = Math.min(time * 14, Math.PI * 2);
      p.armLeft = -1.8;
      p.armRight = -1.8;
      p.legLeft = 0.9;
      p.legRight = 0.9;
      break;
    }
    case 'fall': {
      p.armLeft = -0.6 + Math.sin(time * 6) * 0.2;
      p.armRight = -0.6 - Math.sin(time * 6) * 0.2;
      p.legLeft = 0.3;
      p.legRight = -0.3;
      break;
    }
    case 'land': {
      p.squash = 0.82;
      p.legLeft = 0.4;
      p.legRight = 0.4;
      p.armLeft = 0.5;
      p.armRight = -0.5;
      break;
    }
    case 'light': {
      // Quick jab: one arm punches forward on the active window.
      const punch = Math.sin(Math.min(attackProgress, 1) * Math.PI);
      p.armRight = -1.5 * punch - 0.1;
      p.bodyTilt = 0.1 * punch;
      break;
    }
    case 'heavy': {
      const wind = attackProgress < 0.4 ? attackProgress / 0.4 : 1;
      const strike = Math.max(0, (attackProgress - 0.4) / 0.6);
      p.armRight = -0.4 + wind * 0.9 - strike * 2.3;
      p.bodyTilt = -0.2 * wind + 0.35 * strike;
      p.armLeft = 0.5 * strike;
      break;
    }
    case 'special': {
      const spin = Math.sin(attackProgress * Math.PI * 2);
      p.armLeft = spin * 1.6;
      p.armRight = -spin * 1.6;
      p.bodyRotY = attackProgress * Math.PI;
      p.legRight = 0.6 * Math.sin(attackProgress * Math.PI);
      break;
    }
    case 'ultimate': {
      // Dramatic wind-up then explosive strike (works for divekicks too).
      const charge = Math.min(attackProgress * 2, 1);
      const release = Math.max(0, (attackProgress - 0.5) * 2);
      p.armLeft = -2 * charge + release * 1.5;
      p.armRight = -2 * charge + release * 1.5;
      p.legRight = release * 1.4;
      p.bodyTilt = -0.3 * charge + 0.5 * release;
      p.squash = 1 + charge * 0.1;
      p.bodyRotY = release * Math.PI * 0.5;
      break;
    }
    case 'dash': {
      p.bodyTilt = 0.5;
      p.armLeft = 1.2;
      p.armRight = 1.2;
      p.legLeft = -0.6;
      p.legRight = 0.6;
      break;
    }
    case 'dodge': {
      p.squash = 0.9;
      p.bodyRotY = time * 20;
      p.armLeft = 1;
      p.armRight = 1;
      break;
    }
    case 'shield': {
      p.armLeft = -0.9;
      p.armRight = -0.9;
      p.bodyY = -0.05;
      break;
    }
    case 'hit': {
      p.bodyTilt = -0.4;
      p.armLeft = -1 + Math.sin(time * 30) * 0.3;
      p.armRight = -1 - Math.sin(time * 30) * 0.3;
      p.headTilt = -0.3;
      break;
    }
    case 'knockback': {
      p.bodyRotY = time * 10;
      p.bodyTilt = -0.6;
      p.armLeft = -1.6;
      p.armRight = -1.6;
      p.legLeft = -0.8;
      p.legRight = -0.8;
      break;
    }
    case 'victory': {
      p.armLeft = -2.4;
      p.armRight = -2.4;
      p.bodyY = Math.abs(Math.sin(time * 4)) * 0.15;
      break;
    }
    case 'defeat': {
      p.bodyTilt = 0.9;
      p.headTilt = 0.4;
      p.armLeft = 0.3;
      p.armRight = 0.3;
      break;
    }
  }

  // Subtle extra motion scaled by speed for grounded locomotion blends.
  if ((state === 'walk' || state === 'run') && speed > 0) {
    p.bodyRotY += 0;
  }
  return p;
}
