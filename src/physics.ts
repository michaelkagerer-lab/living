import type { Particle, MouseState } from './types';
import { torusXY } from './particles';
import {
  SPRING_K, DAMPING,
  REPEL_RADIUS, REPEL_STRENGTH, REPEL_SPEED_K,
  ATTRACT_RADIUS, ATTRACT_STRENGTH,
  BREATH_FREQ, BREATH_AMP,
  NOISE_STRENGTH, WANDER_SCALE, WANDER_SPEED,
  ROTATION_SPEED, TILT_SPEED, TILT_AMP, TORUS_Y_SQUISH,
  ENERGY_DECAY, ENERGY_MAX,
  ALIGN_K,
  MOOD_FREQ, MOOD_AMP, MOOD_BIAS,
  HEARTBEAT_FREQ, HEARTBEAT_AMP,
  STARTLE_K,
  TWITCH_INTERVAL, TWITCH_THRESHOLD, TWITCH_STRENGTH,
  TAU,
} from './config';

const REPEL_RADIUS_SQ   = REPEL_RADIUS   * REPEL_RADIUS;
const ATTRACT_RADIUS_SQ = ATTRACT_RADIUS * ATTRACT_RADIUS;

// ── Wander force — dual-octave position-sampled flow field ────────────────────
// Primary octave gives coherent local drift; secondary adds fine-grained texture.
function wanderForce(
  x: number, y: number, time: number, phase: number,
): [number, number] {
  const wx = x * WANDER_SCALE;
  const wy = y * WANDER_SCALE;
  const wt = time * WANDER_SPEED;

  const ang1 = Math.sin(wx + wt) * Math.cos(wy * 0.78 + wt * 0.63) * TAU + phase;
  const ang2 = Math.sin(wx * 2.1 + wt * 1.7) * Math.cos(wy * 1.9 + wt * 2.3) * TAU;

  // Blend primary + 30% secondary octave (vector sum, not angle blend)
  const fx = Math.cos(ang1) + Math.cos(ang2) * 0.3;
  const fy = Math.sin(ang1) + Math.sin(ang2) * 0.3;
  return [fx * NOISE_STRENGTH, fy * NOISE_STRENGTH];
}

// ── Alignment grid (velocity flocking) ───────────────────────────────────────
const cellVx  = new Map<number, number>();
const cellVy  = new Map<number, number>();
const cellN   = new Map<number, number>();
const cellKey = new Map<number, number>();

const ALIGN_CELL = 32;
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
): { breathValue: number; excitement: number } {
  const minDim    = Math.min(width, height);
  const ySquish   = TORUS_Y_SQUISH * (1 + Math.sin(time * TILT_SPEED) * TILT_AMP);
  const mouseActive = mouse.active;
  const mouseX      = mouse.x;
  const mouseY      = mouse.y;
  const speedBoost  = 1 + mouse.speed * REPEL_SPEED_K;

  // ── Autonomous mood oscillator (dual-frequency, curious-biased) ───────────
  // Non-repeating via golden-ratio harmonic. Biased toward curiosity (+MOOD_BIAS).
  const moodBase = Math.sin(time * MOOD_FREQ * TAU);
  const moodHarm = Math.sin(time * MOOD_FREQ * TAU * 1.6180339887) * 0.4;
  const mood     = (moodBase + moodHarm) / 1.4 * 0.85 + MOOD_BIAS;
  // mood ∈ approximately [MOOD_BIAS − 0.85, MOOD_BIAS + 0.85]

  // ── Heartbeat CPG ─────────────────────────────────────────────────────────
  const heartbeat = Math.sin(time * HEARTBEAT_FREQ * TAU) * HEARTBEAT_AMP;

  // ── Approach-speed coupling ────────────────────────────────────────────────
  // Anxious phase lowers startle threshold (hair-trigger)
  const startleThreshold = mouseActive && mood < 0 ? 2.5 : 3.5;
  const aggression = mouseActive
    ? Math.max(0, (mouse.speed - startleThreshold) / 3.0)
    : 0;
  const gentleness = mouseActive
    ? Math.max(0, 1 - mouse.speed / 1.5)
    : 0;

  // ── Effective breath amplitude (mood + gentleness modulated) ──────────────
  // Curious phase: fuller breathing; gentle visitor: blooms open
  const moodBreathBoost   = mood > 0 ? mood * 0.20 : mood * 0.12;
  const effectiveBreathAmp = BREATH_AMP * (1 + moodBreathBoost + gentleness * 0.25);

  // ── Quirk twitch (deterministic, fires ~every 9s) ─────────────────────────
  const twitchSlot = Math.floor(time / TWITCH_INTERVAL);
  const twitchRaw  = Math.sin(twitchSlot * 127.1 + 311.7) * 43758.5453;
  const twitchFrac = twitchRaw - Math.floor(twitchRaw);
  const twitchActive = twitchFrac > TWITCH_THRESHOLD;
  let twitchAx = 0;
  let twitchAy = 0;
  if (twitchActive) {
    const twitchAng = twitchRaw * TAU;
    twitchAx = Math.cos(twitchAng) * TWITCH_STRENGTH;
    twitchAy = Math.sin(twitchAng) * TWITCH_STRENGTH;
  }

  // ── Effective attraction strength (mood modulated) ─────────────────────────
  const effectiveAttract = ATTRACT_STRENGTH * (1 + (mood > 0 ? mood * MOOD_AMP : 0));

  buildAlignGrid(particles, width);

  let totalEnergy = 0;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // ── Rotation + home recompute ─────────────────────────────────────────────
    p.phi += ROTATION_SPEED;
    const [hx, hy] = torusXY(p.phi, p.theta, cx, cy, minDim, ySquish);
    p.hx = hx;
    p.hy = hy;

    let ax = 0;
    let ay = 0;

    // ── Breathing (dual-frequency + heartbeat CPG) ────────────────────────────
    const bt      = time * BREATH_FREQ * TAU;
    const breathA = Math.sin(bt + p.phase);
    const breathB = Math.sin(bt * 1.6180339887 + p.phase * 1.4) * 0.38;
    const breathScale = 1 + effectiveBreathAmp * (breathA + breathB) + heartbeat;
    const hxEff = cx + (p.hx - cx) * breathScale;
    const hyEff = cy + (p.hy - cy) * breathScale;

    // ── Spring toward home (temperament-scaled stiffness) ─────────────────────
    // Shy particles (low temperament) use near-full spring; bold ones softer
    const anxietySpringBoost = mood < 0 ? (1 + Math.abs(mood) * 0.3) : 1;
    const effectiveK = SPRING_K * (0.65 + p.temperament * 0.70) * anxietySpringBoost;
    ax += (hxEff - p.x) * effectiveK;
    ay += (hyEff - p.y) * effectiveK;

    // ── Wander (temperament-scaled amplitude) ─────────────────────────────────
    const [wx, wy] = wanderForce(p.x, p.y, time, p.phase);
    const wanderScale = 0.45 + p.temperament * 1.10;
    ax += wx * wanderScale;
    ay += wy * wanderScale;

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
          // Curiosity zone — bell-shaped, zero at both boundaries (no ring artifact)
          const dist    = Math.sqrt(distSq);
          const t       = (dist - REPEL_RADIUS) / (ATTRACT_RADIUS - REPEL_RADIUS);
          const bell    = 4 * t * (1 - t);
          const force   = effectiveAttract * bell;
          const invDist = 1 / dist;
          ax -= dx * invDist * force;
          ay -= dy * invDist * force;
        }
      }

      // ── Startle — inward contraction on aggressive approach ──────────────────
      if (aggression > 0) {
        ax -= (p.x - cx) * STARTLE_K * aggression * speedBoost;
        ay -= (p.y - cy) * STARTLE_K * aggression * speedBoost;
      }
    }

    // ── Velocity alignment (flocking) ─────────────────────────────────────────
    const k     = cellKey.get(i) ?? 0;
    const n     = cellN.get(k) ?? 1;
    const avgVx = (cellVx.get(k) ?? 0) / n;
    const avgVy = (cellVy.get(k) ?? 0) / n;
    ax += (avgVx - p.vx) * ALIGN_K;
    ay += (avgVy - p.vy) * ALIGN_K;

    // ── Quirk twitches (bold particles twitch more) ───────────────────────────
    if (twitchActive) {
      ax += twitchAx * p.temperament;
      ay += twitchAy * p.temperament;
    }

    // ── Euler integration ─────────────────────────────────────────────────────
    p.vx = (p.vx + ax) * DAMPING;
    p.vy = (p.vy + ay) * DAMPING;
    p.x += p.vx;
    p.y += p.vy;

    // ── Particle energy EMA ───────────────────────────────────────────────────
    const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    p.energy  = Math.min(
      p.energy * ENERGY_DECAY + spd * (1 - ENERGY_DECAY),
      ENERGY_MAX,
    );
    totalEnergy += p.energy;
  }

  const breathValue = Math.sin(time * BREATH_FREQ * TAU);
  const excitement  = totalEnergy / particles.length / ENERGY_MAX;

  return { breathValue, excitement };
}
