import type { Particle } from './types';
import {
  PARTICLE_COUNT,
  TORUS_R_MAJOR, TORUS_R_MINOR, TORUS_Y_SQUISH,
  DOT_MIN, DOT_MAX,
  COLOR_CUMULATIVE,
  LEADER_FRACTION,
  TAU,
} from './config';

export function torusXY(
  phi: number, theta: number,
  cx: number, cy: number,
  minDim: number,
  ySquish: number = TORUS_Y_SQUISH,
  xShear: number = 0,
): [number, number] {
  const R = TORUS_R_MAJOR * minDim;
  const r = TORUS_R_MINOR * minDim;
  const tubeFactor = R + r * Math.cos(theta);
  return [
    cx + tubeFactor * Math.cos(phi) + xShear * tubeFactor,
    cy + tubeFactor * Math.sin(phi) * ySquish,
  ];
}

function pickColor(rand: number): number {
  for (let c = 0; c < COLOR_CUMULATIVE.length; c++) {
    if (rand < COLOR_CUMULATIVE[c]) return c;
  }
  return COLOR_CUMULATIVE.length - 1;
}

function resolveParticleCount(): number {
  const cores = navigator.hardwareConcurrency ?? 4;
  if (cores <= 2) return 800;
  if (cores <= 4) return 1400;
  return PARTICLE_COUNT;
}

export function initParticles(width: number, height: number): Particle[] {
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);
  const count = resolveParticleCount();
  const particles: Particle[] = new Array(count);

  for (let i = 0; i < count; i++) {
    const phi   = Math.random() * TAU;
    const theta = Math.random() * TAU;
    const [hx, hy] = torusXY(phi, theta, cx, cy, minDim);
    const depth = (Math.cos(theta) + 1) * 0.5; // 0 = back, 1 = front

    // Bimodal temperament: ~50% shy (0..0.38), ~50% bold (0.62..1.0), few in-between
    const tr = Math.random();
    const temperament = tr < 0.5 ? tr * 0.76 : 0.62 + (tr - 0.5) * 0.76;

    particles[i] = {
      id: i,
      x: hx, y: hy,
      vx: 0, vy: 0,
      hx, hy,
      phi, theta,
      phase: Math.random() * TAU,
      dotRadius: DOT_MIN + depth * (DOT_MAX - DOT_MIN),
      colorIndex: pickColor(Math.random()),
      isNear: Math.cos(theta) > 0,
      temperament,
      isLeader: Math.random() < LEADER_FRACTION,
      energy: 0,
    };
  }

  return particles;
}


export function repositionHomes(
  particles: Particle[],
  width: number,
  height: number,
): void {
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);
  for (const p of particles) {
    const [hx, hy] = torusXY(p.phi, p.theta, cx, cy, minDim);
    p.hx = hx;
    p.hy = hy;
  }
}
