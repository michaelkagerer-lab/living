import type { Particle, MouseState } from './types';
import {
  SPRING_K, DAMPING,
  REPEL_RADIUS, REPEL_STRENGTH, REPEL_SPEED_K,
  BREATH_FREQ, BREATH_AMP,
  NOISE_STRENGTH, WANDER_SCALE, WANDER_SPEED,
  TAU,
} from './config';

const REPEL_RADIUS_SQ = REPEL_RADIUS * REPEL_RADIUS;

// Position-sampled wander field: nearby particles share similar field values
// so they drift in coherent local currents — organic "flock" feel with zero
// neighbour queries. The golden-ratio secondary frequency keeps the breath
// pattern from ever exactly repeating on human timescales.
function wanderForce(
  x: number, y: number, time: number, phase: number,
): [number, number] {
  const wx  = x * WANDER_SCALE;
  const wy  = y * WANDER_SCALE;
  const wt  = time * WANDER_SPEED;
  // Map the field value to a full rotation so force direction is uniform
  const ang = Math.sin(wx + wt) * Math.cos(wy * 0.78 + wt * 0.63) * TAU + phase;
  return [Math.cos(ang) * NOISE_STRENGTH, Math.sin(ang) * NOISE_STRENGTH];
}

export function updateParticles(
  particles: Particle[],
  mouse: MouseState,
  cx: number,
  cy: number,
  time: number,
): void {
  const mouseActive = mouse.active;
  const mouseX      = mouse.x;
  const mouseY      = mouse.y;
  const speedBoost  = 1 + mouse.speed * REPEL_SPEED_K;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    let ax = 0;
    let ay = 0;

    // ── Dual-frequency breathing ─────────────────────────────────────────────
    // Primary + golden-ratio secondary wave: the irrational ratio means the
    // combined pattern never exactly repeats, producing genuinely organic rhythm.
    const bt = time * BREATH_FREQ * TAU;
    const breathA = Math.sin(bt + p.phase);
    const breathB = Math.sin(bt * 1.6180339887 + p.phase * 1.4) * 0.38;
    const breathScale = 1 + BREATH_AMP * (breathA + breathB);
    const hxEff = cx + (p.hx - cx) * breathScale;
    const hyEff = cy + (p.hy - cy) * breathScale;

    // ── Spring toward breathing home ──────────────────────────────────────────
    ax += (hxEff - p.x) * SPRING_K;
    ay += (hyEff - p.y) * SPRING_K;

    // ── Organic wander ───────────────────────────────────────────────────────
    // Slow position-based flow field that drifts continuously. The spring
    // always wins at larger displacements, so particles stay in the shell
    // while gently exploring their neighbourhood.
    const [wx, wy] = wanderForce(p.x, p.y, time, p.phase);
    ax += wx;
    ay += wy;

    // ── Mouse antigravity repulsion ──────────────────────────────────────────
    if (mouseActive) {
      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const distSq = dx * dx + dy * dy;
      if (distSq < REPEL_RADIUS_SQ && distSq > 0.0001) {
        const dist    = Math.sqrt(distSq);
        const t       = 1 - dist / REPEL_RADIUS;
        const force   = REPEL_STRENGTH * t * t * speedBoost;
        const invDist = 1 / dist;
        ax += dx * invDist * force;
        ay += dy * invDist * force;
      }
    }

    // ── Semi-implicit Euler ──────────────────────────────────────────────────
    p.vx = (p.vx + ax) * DAMPING;
    p.vy = (p.vy + ay) * DAMPING;
    p.x += p.vx;
    p.y += p.vy;
  }
}
