import type { Particle, MouseState } from './types';
import { torusXY } from './particles';
import {
  SPRING_K, DAMPING,
  REPEL_RADIUS, REPEL_STRENGTH, REPEL_SPEED_K,
  ATTRACT_RADIUS, ATTRACT_STRENGTH,
  BREATH_FREQ, BREATH_AMP,
  NOISE_STRENGTH, WANDER_SCALE, WANDER_SPEED,
  ROTATION_SPEED, TILT_SPEED, TILT_AMP, TORUS_Y_SQUISH,
  ENERGY_DECAY,
  ALIGN_K,
  TAU,
} from './config';

const REPEL_RADIUS_SQ  = REPEL_RADIUS  * REPEL_RADIUS;
const ATTRACT_RADIUS_SQ = ATTRACT_RADIUS * ATTRACT_RADIUS;

function wanderForce(
  x: number, y: number, time: number, phase: number,
): [number, number] {
  const wx  = x * WANDER_SCALE;
  const wy  = y * WANDER_SCALE;
  const wt  = time * WANDER_SPEED;
  const ang = Math.sin(wx + wt) * Math.cos(wy * 0.78 + wt * 0.63) * TAU + phase;
  return [Math.cos(ang) * NOISE_STRENGTH, Math.sin(ang) * NOISE_STRENGTH];
}

// Per-cell velocity accumulators for emergent flocking alignment
const cellVx  = new Map<number, number>();
const cellVy  = new Map<number, number>();
const cellN   = new Map<number, number>();
const cellKey = new Map<number, number>(); // particle index → cell key

const ALIGN_CELL = 32; // px — grid cell size for alignment
let alignCols = 1;

function buildAlignGrid(particles: Particle[], width: number): void {
  alignCols = Math.ceil(width / ALIGN_CELL) + 2;
  cellVx.clear(); cellVy.clear(); cellN.clear(); cellKey.clear();
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const k = Math.floor(p.y / ALIGN_CELL) * alignCols + Math.floor(p.x / ALIGN_CELL);
    cellKey.set(i, k);
    cellVx.set(k, (cellVx.get(k) ?? 0) + p.vx);
    cellVy.set(k, (cellVy.get(k) ?? 0) + p.vy);
    cellN.set(k,  (cellN.get(k)  ?? 0) + 1);
  }
}

export function updateParticles(
  particles: Particle[],
  mouse: MouseState,
  cx: number,
  cy: number,
  width: number,
  height: number,
  time: number,
): number {
  const minDim    = Math.min(width, height);
  const ySquish   = TORUS_Y_SQUISH * (1 + Math.sin(time * TILT_SPEED) * TILT_AMP);
  const mouseActive = mouse.active;
  const mouseX      = mouse.x;
  const mouseY      = mouse.y;
  const speedBoost  = 1 + mouse.speed * REPEL_SPEED_K;

  // Build alignment grid from previous frame velocities
  buildAlignGrid(particles, width);

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // ── Rotation: advance phi and recompute home position ─────────────────────
    p.phi += ROTATION_SPEED;
    const [hx, hy] = torusXY(p.phi, p.theta, cx, cy, minDim, ySquish);
    p.hx = hx;
    p.hy = hy;

    let ax = 0;
    let ay = 0;

    // ── Dual-frequency breathing ──────────────────────────────────────────────
    const bt      = time * BREATH_FREQ * TAU;
    const breathA = Math.sin(bt + p.phase);
    const breathB = Math.sin(bt * 1.6180339887 + p.phase * 1.4) * 0.38;
    const breathScale = 1 + BREATH_AMP * (breathA + breathB);
    const hxEff = cx + (p.hx - cx) * breathScale;
    const hyEff = cy + (p.hy - cy) * breathScale;

    // ── Spring toward breathing home ──────────────────────────────────────────
    ax += (hxEff - p.x) * SPRING_K;
    ay += (hyEff - p.y) * SPRING_K;

    // ── Organic wander ────────────────────────────────────────────────────────
    const [wx, wy] = wanderForce(p.x, p.y, time, p.phase);
    ax += wx;
    ay += wy;

    // ── Mouse interaction ─────────────────────────────────────────────────────
    if (mouseActive) {
      const dx     = p.x - mouseX;
      const dy     = p.y - mouseY;
      const distSq = dx * dx + dy * dy;

      if (distSq > 0.0001) {
        if (distSq < REPEL_RADIUS_SQ) {
          // Repulsion bubble
          const dist    = Math.sqrt(distSq);
          const t       = 1 - dist / REPEL_RADIUS;
          const force   = REPEL_STRENGTH * t * t * speedBoost;
          const invDist = 1 / dist;
          ax += dx * invDist * force;
          ay += dy * invDist * force;
        } else if (distSq < ATTRACT_RADIUS_SQ) {
          // Curiosity zone — gentle pull toward cursor
          const dist    = Math.sqrt(distSq);
          const t       = 1 - (dist - REPEL_RADIUS) / (ATTRACT_RADIUS - REPEL_RADIUS);
          const force   = ATTRACT_STRENGTH * t * t;
          const invDist = 1 / dist;
          ax -= dx * invDist * force;
          ay -= dy * invDist * force;
        }
      }
    }

    // ── Local velocity alignment (flocking) ───────────────────────────────────
    const k    = cellKey.get(i) ?? 0;
    const n    = cellN.get(k) ?? 1;
    const avgVx = (cellVx.get(k) ?? 0) / n;
    const avgVy = (cellVy.get(k) ?? 0) / n;
    ax += (avgVx - p.vx) * ALIGN_K;
    ay += (avgVy - p.vy) * ALIGN_K;

    // ── Semi-implicit Euler ───────────────────────────────────────────────────
    p.vx = (p.vx + ax) * DAMPING;
    p.vy = (p.vy + ay) * DAMPING;
    p.x += p.vx;
    p.y += p.vy;

    // ── Particle energy EMA (drives glow) ─────────────────────────────────────
    const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    p.energy  = p.energy * ENERGY_DECAY + spd * (1 - ENERGY_DECAY);
  }

  // Return breath value so renderer can pulse the background glow
  return Math.sin(time * BREATH_FREQ * TAU);
}
