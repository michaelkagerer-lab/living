import type { Particle, MouseState, BehaviorState } from './types';
import { torusXY } from './particles';
import {
  SPRING_K, DAMPING,
  VEL_CAP,
  REPEL_RADIUS, REPEL_STRENGTH, REPEL_SPEED_K, SPEED_BOOST_CAP,
  ATTRACT_RADIUS, ATTRACT_STRENGTH,
  BREATH_FREQ, BREATH_AMP,
  NOISE_STRENGTH, WANDER_SCALE, WANDER_SPEED,
  ROTATION_SPEED, TILT_SPEED, TILT_AMP, TORUS_Y_SQUISH,
  ENERGY_DECAY, ENERGY_MAX,
  ALIGN_K, ALIGN_MAX_CELLS,
  COHESION_K, SEPARATE_RADIUS, SEPARATE_RADIUS_SQ, SEPARATE_K,
  MOOD_FREQ, MOOD_AMP, MOOD_BIAS,
  HEARTBEAT_FREQ, HEARTBEAT_AMP,
  STARTLE_K, AGGRESSION_CAP, STARTLE_TRIGGER_THRESHOLD, STARTLE_RECOVERY_MS,
  TWITCH_INTERVAL, TWITCH_THRESHOLD, TWITCH_STRENGTH,
  GAZE_INTERVAL_MS, GAZE_LERP_RATE, GAZE_RADIUS, GAZE_STRENGTH,
  AFTERGLOW_DURATION_MS, AFTERGLOW_STRENGTH,
  TRUST_SPEED_THRESHOLD, TRUST_BUILD_MS, TRUST_DECAY_MS, TRUST_ATTRACT_SCALE,
  TILT_DEVICE_AMP,
  GESTURE_SPIN_FRAMES, GESTURE_SPIN_MULT,
  HOVER_GAZE_SNAP_MS, HOVER_GAZE_HOLD_MS,
  STATE_MOOD_CURIOUS_THRESHOLD, STATE_MOOD_RESTING_THRESHOLD,
  STATE_STARTLE_HOLD_MS, STATE_CAUTIOUS_HOLD_MS,
  STATE_PLAYFUL_TRUST_MIN, STATE_PLAYFUL_MOOD_MIN,
  STATE_TRANSITION_DAMP,
  HABITUATION_DECAY_MS, HABITUATION_MAX_COUNT,
  HABITUATION_MIN_SCALE, SENSITIZATION_WINDOW_MS, SENSITIZATION_BOOST,
  LEADER_WANDER_MULT, LEADER_SPRING_MULT, LEADER_ALIGN_WEIGHT, LEADER_GAZE_MULT,
  CIRCADIAN_FREQ, CIRCADIAN_AMP, CIRCADIAN_BIAS, CIRCADIAN_WANDER_K, CIRCADIAN_BREATH_K,
  PREDICT_LEAD_MS, PREDICT_RADIUS, PREDICT_STRENGTH,
  PARTICLE_COUNT, WANDER_CACHE_INTERVAL,
  TAU,
} from './config';

const REPEL_RADIUS_SQ    = REPEL_RADIUS    * REPEL_RADIUS;
const ATTRACT_RADIUS_SQ  = ATTRACT_RADIUS  * ATTRACT_RADIUS;
const GAZE_RADIUS_SQ     = GAZE_RADIUS     * GAZE_RADIUS;
const PREDICT_RADIUS_SQ  = PREDICT_RADIUS  * PREDICT_RADIUS;

// ── Wander force — dual-octave position-sampled flow field ────────────────────
function wanderForce(
  x: number, y: number, time: number, phase: number,
): [number, number] {
  const wx = x * WANDER_SCALE;
  const wy = y * WANDER_SCALE;
  const wt = time * WANDER_SPEED;
  const ang1 = Math.sin(wx + wt) * Math.cos(wy * 0.78 + wt * 0.63) * TAU + phase;
  const ang2 = Math.sin(wx * 2.1 + wt * 1.7) * Math.cos(wy * 1.9 + wt * 2.3) * TAU;
  const fx = Math.cos(ang1) + Math.cos(ang2) * 0.3;
  const fy = Math.sin(ang1) + Math.sin(ang2) * 0.3;
  return [fx * NOISE_STRENGTH, fy * NOISE_STRENGTH];
}

// ── Short-arc angle lerp ──────────────────────────────────────────────────────
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  if (d >  Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

// ── Typed-array alignment + boids grid ───────────────────────────────────────
const alignVx   = new Float32Array(ALIGN_MAX_CELLS);
const alignVy   = new Float32Array(ALIGN_MAX_CELLS);
const alignCx   = new Float32Array(ALIGN_MAX_CELLS);
const alignCy   = new Float32Array(ALIGN_MAX_CELLS);
const alignN    = new Float32Array(ALIGN_MAX_CELLS);  // float to support leader weighting
const alignIdx  = new Int32Array(PARTICLE_COUNT);
const usedCells = new Uint16Array(ALIGN_MAX_CELLS);
let   usedCount = 0;
let   alignCols = 1;

// ── Wander force cache (updated every WANDER_CACHE_INTERVAL frames) ───────────
const wanderCacheX = new Float32Array(PARTICLE_COUNT);
const wanderCacheY = new Float32Array(PARTICLE_COUNT);
let wanderTick = 0;

const ALIGN_CELL = 32;

function buildAlignGrid(particles: Particle[], width: number): void {
  for (let i = 0; i < usedCount; i++) {
    const c = usedCells[i];
    alignVx[c] = 0; alignVy[c] = 0;
    alignCx[c] = 0; alignCy[c] = 0;
    alignN[c]  = 0;
  }
  usedCount = 0;
  alignCols = Math.ceil(width / ALIGN_CELL) + 2;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const row = Math.max(0, (p.y / ALIGN_CELL) | 0);
    const col = Math.max(0, (p.x / ALIGN_CELL) | 0);
    const k   = Math.min(ALIGN_MAX_CELLS - 1, row * alignCols + col);
    if (alignN[k] === 0) usedCells[usedCount++] = k;
    alignIdx[i] = k;
    const w = p.isLeader ? LEADER_ALIGN_WEIGHT : 1;
    alignVx[k] += p.vx * w;
    alignVy[k] += p.vy * w;
    alignCx[k] += p.x * w;
    alignCy[k] += p.y * w;
    alignN[k]  += w;
  }
}

// ── Gaze target — autonomous idle attention ───────────────────────────────────
let gazePhi         = 0;
let gazeTheta       = 0;
let gazeTargetPhi   = Math.random() * TAU;
let gazeTargetTheta = Math.random() * TAU;
let gazeNextUpdate  = 0;

// ── Mouse afterglow — memory of presence ─────────────────────────────────────
const afterglow = { x: 0, y: 0, strength: 0 };
const AFTERGLOW_DECAY = 1 / (AFTERGLOW_DURATION_MS / 16);

// ── Trust + startle recovery ──────────────────────────────────────────────────
let trustLevel      = 0;
let startleRecovery = 0;
const TRUST_BUILD_RATE        = 1 / (TRUST_BUILD_MS  / 16);
const TRUST_DECAY_RATE        = 1 / (TRUST_DECAY_MS  / 16);
const STARTLE_RECOVERY_FRAMES = Math.round(STARTLE_RECOVERY_MS / 16);

// ── Gesture state ─────────────────────────────────────────────────────────────
let gestureRotationBoost = 0;
let gestureScatter       = false;
let hoverDeepMs          = 0;

// ── Startle leading-edge detection ────────────────────────────────────────────
let prevAggression = 0;

// ── Behavioral state machine ──────────────────────────────────────────────────
let behaviorState: BehaviorState = 'RESTING';
let stateEnteredAt = 0;
let stateBlend     = 0;

// Per-state physics multipliers [wanderScale, springK, attractStrength, alignK]
const STATE_MULTS: Record<BehaviorState, [number, number, number, number]> = {
  RESTING:  [0.5, 1.2, 0.6, 0.8],
  CURIOUS:  [1.0, 1.0, 1.0, 1.0],
  PLAYFUL:  [1.4, 0.7, 1.3, 1.2],
  CAUTIOUS: [0.7, 1.4, 0.5, 1.3],
  STARTLED: [0.3, 1.6, 0.2, 0.6],
};

// ── Startle habituation / sensitization ──────────────────────────────────────
let startleCount         = 0;
let lastStartleTime      = -99999;
let startleResponseScale = 1.0;

export function updateParticles(
  particles: Particle[],
  mouse: MouseState,
  cx: number,
  cy: number,
  width: number,
  height: number,
  time: number,
  tilt: { x: number; y: number } = { x: 0, y: 0 },
): {
  breathValue: number;
  excitement: number;
  mood: number;
  twitchFired: boolean;
  startleFired: boolean;
  behaviorState: BehaviorState;
  circadian: number;
  startleResponseScale: number;
} {
  const minDim      = Math.min(width, height);
  const ySquish     = TORUS_Y_SQUISH * (1 + Math.sin(time * TILT_SPEED) * TILT_AMP)
                    + tilt.y * TILT_DEVICE_AMP;
  const xShear      = tilt.x * TILT_DEVICE_AMP * 0.5;
  const mouseActive = mouse.active;
  const mouseX      = mouse.x;
  const mouseY      = mouse.y;
  const speedBoost  = Math.min(1 + mouse.speed * REPEL_SPEED_K, SPEED_BOOST_CAP);

  // ── Circadian envelope (~3.5 min period) ─────────────────────────────────
  const circadian = Math.sin(time * CIRCADIAN_FREQ * TAU) * CIRCADIAN_AMP + CIRCADIAN_BIAS;

  // ── Autonomous mood oscillator ────────────────────────────────────────────
  const moodBase = Math.sin(time * MOOD_FREQ * TAU);
  const moodHarm = Math.sin(time * MOOD_FREQ * TAU * 1.6180339887) * 0.4;
  const mood     = (moodBase + moodHarm) / 1.4 * 0.85 + MOOD_BIAS;

  // ── Heartbeat CPG ─────────────────────────────────────────────────────────
  const heartbeat = Math.sin(time * HEARTBEAT_FREQ * TAU) * HEARTBEAT_AMP;

  // ── Approach-speed coupling ───────────────────────────────────────────────
  const startleThreshold = mouseActive && mood < 0 ? 2.5 : 3.5;
  const aggression = mouseActive
    ? Math.min(Math.max(0, (mouse.speed - startleThreshold) / 3.0), AGGRESSION_CAP)
    : 0;
  const gentleness = mouseActive ? Math.max(0, 1 - mouse.speed / 1.5) : 0;

  // ── Startle leading-edge ──────────────────────────────────────────────────
  const startleFired = aggression > STARTLE_TRIGGER_THRESHOLD && prevAggression <= STARTLE_TRIGGER_THRESHOLD;
  prevAggression     = aggression;

  // ── Startle habituation / sensitization ──────────────────────────────────
  if (startleFired) {
    const timeSinceLast = time - lastStartleTime;
    if (timeSinceLast < SENSITIZATION_WINDOW_MS) {
      startleResponseScale = Math.min(startleResponseScale * SENSITIZATION_BOOST, 2.5);
    } else {
      startleCount = Math.min(startleCount + 1, HABITUATION_MAX_COUNT);
    }
    lastStartleTime = time;
  }
  startleCount = Math.max(0, startleCount - 16 / HABITUATION_DECAY_MS);
  const habFraction  = startleCount / HABITUATION_MAX_COUNT;
  const targetScale  = HABITUATION_MIN_SCALE + (1 - habFraction) * (1 - HABITUATION_MIN_SCALE);
  startleResponseScale += (targetScale - startleResponseScale) * 0.02;

  // ── Behavioral state machine ──────────────────────────────────────────────
  const elapsed = time - stateEnteredAt;
  const prevState = behaviorState;

  const circadianRestBias = circadian < -0.20;
  const circadianActiveBias = circadian > 0.30;

  switch (behaviorState) {
    case 'RESTING':
      if (!circadianRestBias && mood > STATE_MOOD_CURIOUS_THRESHOLD && elapsed > 2000)
        behaviorState = 'CURIOUS';
      break;
    case 'CURIOUS':
      if (startleFired)
        behaviorState = 'CAUTIOUS';
      else if (trustLevel > STATE_PLAYFUL_TRUST_MIN && mood > STATE_PLAYFUL_MOOD_MIN && !circadianRestBias)
        behaviorState = 'PLAYFUL';
      else if (mood < STATE_MOOD_RESTING_THRESHOLD && !circadianActiveBias)
        behaviorState = 'RESTING';
      break;
    case 'PLAYFUL':
      if (aggression > STARTLE_TRIGGER_THRESHOLD)
        behaviorState = 'STARTLED';
      else if (trustLevel < STATE_PLAYFUL_TRUST_MIN * 0.5 || circadianRestBias)
        behaviorState = 'CURIOUS';
      break;
    case 'STARTLED':
      if (elapsed > STATE_STARTLE_HOLD_MS)
        behaviorState = 'CAUTIOUS';
      break;
    case 'CAUTIOUS':
      if (startleFired) {
        stateEnteredAt = time; // reset hold timer — re-startled in caution
      } else if (elapsed > STATE_CAUTIOUS_HOLD_MS) {
        behaviorState = (trustLevel > 0.3 && mood > 0) ? 'CURIOUS' : 'RESTING';
      }
      break;
  }

  if (behaviorState !== prevState) {
    stateBlend     = 0;
    stateEnteredAt = time;
  }
  stateBlend = Math.min(1, stateBlend + STATE_TRANSITION_DAMP);

  // Blend current state multipliers
  const [smWander, smSpring, smAttract, smAlign] = STATE_MULTS[behaviorState];
  const [pmWander, pmSpring, pmAttract, pmAlign] = STATE_MULTS[prevState];
  const stateMixWander  = pmWander  + (smWander  - pmWander)  * stateBlend;
  const stateMixSpring  = pmSpring  + (smSpring  - pmSpring)  * stateBlend;
  const stateMixAttract = pmAttract + (smAttract - pmAttract) * stateBlend;
  const stateMixAlign   = pmAlign   + (smAlign   - pmAlign)   * stateBlend;

  // ── Effective breath amplitude ────────────────────────────────────────────
  const moodBreathBoost    = mood > 0 ? mood * 0.20 : mood * 0.12;
  const effectiveBreathAmp = BREATH_AMP
    * (1 + moodBreathBoost + gentleness * 0.25)
    * (1 + circadian * CIRCADIAN_BREATH_K);

  // ── Effective attraction (mood + trust + state modulated) ────────────────
  const effectiveAttract = ATTRACT_STRENGTH
    * (1 + (mood > 0 ? mood * MOOD_AMP : 0))
    * (1 + trustLevel * TRUST_ATTRACT_SCALE)
    * stateMixAttract;

  // ── Quirk twitches ────────────────────────────────────────────────────────
  const twitchSlot   = Math.floor(time / TWITCH_INTERVAL);
  const twitchRaw    = Math.sin(twitchSlot * 127.1 + 311.7) * 43758.5453;
  const twitchFrac   = twitchRaw - Math.floor(twitchRaw);
  const twitchActive = twitchFrac > TWITCH_THRESHOLD;
  let twitchAx = 0;
  let twitchAy = 0;
  if (twitchActive) {
    const twitchAng = twitchRaw * TAU;
    twitchAx = Math.cos(twitchAng) * TWITCH_STRENGTH;
    twitchAy = Math.sin(twitchAng) * TWITCH_STRENGTH;
  }

  // ── Afterglow — trigger on mouse leave, then decay ───────────────────────
  if (mouse.justLeft) {
    mouse.justLeft     = false;
    afterglow.x        = mouse.lastActiveX;
    afterglow.y        = mouse.lastActiveY;
    afterglow.strength = 1.0;
  }
  if (!mouseActive && afterglow.strength > 0) {
    afterglow.strength = Math.max(0, afterglow.strength - AFTERGLOW_DECAY);
  }

  // ── Trust accumulation ────────────────────────────────────────────────────
  if (mouseActive && mouse.speed < TRUST_SPEED_THRESHOLD) {
    const mdx = mouseX - cx;
    const mdy = mouseY - cy;
    if (mdx * mdx + mdy * mdy < ATTRACT_RADIUS_SQ) {
      trustLevel = Math.min(1, trustLevel + TRUST_BUILD_RATE);
    }
  } else {
    trustLevel = Math.max(0, trustLevel - TRUST_DECAY_RATE);
  }

  // ── Post-startle recovery ─────────────────────────────────────────────────
  if (aggression > STARTLE_TRIGGER_THRESHOLD) startleRecovery = STARTLE_RECOVERY_FRAMES;
  const isRecovering     = startleRecovery > 0;
  if (isRecovering) startleRecovery--;
  const recoveryStrength = isRecovering ? startleRecovery / STARTLE_RECOVERY_FRAMES : 0;

  // ── Gesture: circle → spin boost ─────────────────────────────────────────
  if (mouse.gesture === 'circle' && gestureRotationBoost === 0) {
    gestureRotationBoost = GESTURE_SPIN_FRAMES;
  }
  if (mouse.gesture === 'shake') {
    gestureScatter = true;
  }
  const effectiveRotation = gestureRotationBoost > 0
    ? ROTATION_SPEED * GESTURE_SPIN_MULT
    : ROTATION_SPEED;
  if (gestureRotationBoost > 0) gestureRotationBoost--;

  // ── Hover gaze snap — hold still 4s → gaze locks to cursor ──────────────
  if (mouseActive && trustLevel >= 1 && mouse.speed < TRUST_SPEED_THRESHOLD * 0.6) {
    hoverDeepMs += 16;
    if (hoverDeepMs > HOVER_GAZE_SNAP_MS) {
      gazeTargetPhi   = Math.atan2(mouseY - cy, mouseX - cx);
      gazeTargetTheta = Math.PI / 2;
      gazeNextUpdate  = time + HOVER_GAZE_HOLD_MS;
      hoverDeepMs     = 0;
    }
  } else {
    hoverDeepMs = 0;
  }

  // ── Gaze target ───────────────────────────────────────────────────────────
  if (time > gazeNextUpdate) {
    gazeTargetPhi   = Math.random() * TAU;
    gazeTargetTheta = Math.random() * TAU;
    gazeNextUpdate  = time + GAZE_INTERVAL_MS;
  }
  gazePhi   = lerpAngle(gazePhi,   gazeTargetPhi,   GAZE_LERP_RATE);
  gazeTheta = lerpAngle(gazeTheta, gazeTargetTheta, GAZE_LERP_RATE);
  const [gazeWx, gazeWy] = torusXY(
    gazePhi + effectiveRotation * time, gazeTheta, cx, cy, minDim, ySquish, xShear,
  );

  // ── Mouse trajectory prediction ───────────────────────────────────────────
  const predictX = mouseActive ? mouseX + mouse.vx * (PREDICT_LEAD_MS / 16) : -9999;
  const predictY = mouseActive ? mouseY + mouse.vy * (PREDICT_LEAD_MS / 16) : -9999;

  buildAlignGrid(particles, width);

  // Hoisted loop-invariant breath time
  const bt = time * BREATH_FREQ * TAU;

  let totalEnergy = 0;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // ── Rotation + home recompute ─────────────────────────────────────────
    p.phi += effectiveRotation;
    const [hx, hy] = torusXY(p.phi, p.theta, cx, cy, minDim, ySquish, xShear);
    p.hx = hx;
    p.hy = hy;

    let ax = 0;
    let ay = 0;

    // ── Breathing (dual-frequency + heartbeat CPG) ────────────────────────
    const breathA     = Math.sin(bt + p.phase);
    const breathB     = Math.sin(bt * 1.6180339887 + p.phase * 1.4) * 0.38;
    const breathScale = 1 + effectiveBreathAmp * (breathA + breathB) + heartbeat;
    const hxEff = cx + (p.hx - cx) * breathScale;
    const hyEff = cy + (p.hy - cy) * breathScale;

    // ── Spring toward home (state + leader modulated) ─────────────────────
    const anxietySpringBoost = mood < 0 ? (1 + Math.abs(mood) * 0.3) : 1;
    const leaderSpringMult   = p.isLeader ? LEADER_SPRING_MULT : 1.0;
    const effectiveK = SPRING_K * (0.65 + p.temperament * 0.70) * anxietySpringBoost
                     * stateMixSpring * leaderSpringMult;
    ax += (hxEff - p.x) * effectiveK;
    ay += (hyEff - p.y) * effectiveK;

    // ── Wander (state + circadian + leader modulated) ─────────────────────
    if ((i + wanderTick) % WANDER_CACHE_INTERVAL === 0) {
      const [nwx, nwy] = wanderForce(p.x, p.y, time, p.phase);
      wanderCacheX[i] = nwx;
      wanderCacheY[i] = nwy;
    }
    const wx = wanderCacheX[i];
    const wy = wanderCacheY[i];
    const leaderWanderMult = p.isLeader ? LEADER_WANDER_MULT : 1.0;
    const wanderScale = (0.45 + p.temperament * 1.10)
                      * (1 - recoveryStrength * 0.40)
                      * stateMixWander
                      * (1 + circadian * CIRCADIAN_WANDER_K)
                      * leaderWanderMult;
    ax += wx * wanderScale;
    ay += wy * wanderScale;

    // ── Gaze pull (leader modulated) ──────────────────────────────────────
    const gdx     = gazeWx - p.x;
    const gdy     = gazeWy - p.y;
    const gDistSq = gdx * gdx + gdy * gdy;
    if (gDistSq > 0.01 && gDistSq < GAZE_RADIUS_SQ) {
      const leaderGazeMult = p.isLeader ? LEADER_GAZE_MULT : 1.0;
      const inv = GAZE_STRENGTH * leaderGazeMult / Math.sqrt(gDistSq);
      ax += gdx * inv;
      ay += gdy * inv;
    }

    // ── Mouse interaction ─────────────────────────────────────────────────
    if (mouseActive) {
      const dx     = p.x - mouseX;
      const dy     = p.y - mouseY;
      const distSq = dx * dx + dy * dy;

      if (distSq > 0.0001) {
        if (distSq < REPEL_RADIUS_SQ) {
          const dist    = Math.sqrt(distSq);
          const t       = 1 - dist / REPEL_RADIUS;
          const force   = REPEL_STRENGTH * t * t * speedBoost * startleResponseScale;
          const invDist = 1 / dist;
          ax += dx * invDist * force;
          ay += dy * invDist * force;
        } else if (distSq < ATTRACT_RADIUS_SQ) {
          const dist    = Math.sqrt(distSq);
          const t       = (dist - REPEL_RADIUS) / (ATTRACT_RADIUS - REPEL_RADIUS);
          const bell    = 4 * t * (1 - t);
          const force   = effectiveAttract * bell;
          const invDist = 1 / dist;
          ax -= dx * invDist * force;
          ay -= dy * invDist * force;
        }
      }

      if (aggression > 0 && !gestureScatter) {
        ax -= (p.x - cx) * STARTLE_K * aggression * speedBoost * startleResponseScale;
        ay -= (p.y - cy) * STARTLE_K * aggression * speedBoost * startleResponseScale;
      }
    }

    // ── Gesture scatter — outward burst instead of inward startle ────────
    if (gestureScatter) {
      ax += (p.x - cx) * STARTLE_K * 1.5;
      ay += (p.y - cy) * STARTLE_K * 1.5;
    }

    // ── Mouse trajectory prediction ───────────────────────────────────────
    if (mouseActive && mouse.speed > 0.5) {
      const pdx = predictX - p.x;
      const pdy = predictY - p.y;
      const pdSq = pdx * pdx + pdy * pdy;
      if (pdSq > 0.01 && pdSq < PREDICT_RADIUS_SQ) {
        const pdist = Math.sqrt(pdSq);
        const t = pdist / PREDICT_RADIUS;
        const bell = 4 * t * (1 - t);
        const inPath = (pdx * mouse.vx + pdy * mouse.vy) > 0;
        const f = PREDICT_STRENGTH * bell / pdist;
        ax += inPath ? pdx * f : -pdx * f * 0.3;
        ay += inPath ? pdy * f : -pdy * f * 0.3;
      }
    }

    // ── Afterglow attraction ──────────────────────────────────────────────
    if (afterglow.strength > 0) {
      const adx  = afterglow.x - p.x;
      const ady  = afterglow.y - p.y;
      const adSq = adx * adx + ady * ady;
      if (adSq > 0.01 && adSq < ATTRACT_RADIUS_SQ) {
        const adist = Math.sqrt(adSq);
        const t     = (adist - REPEL_RADIUS) / (ATTRACT_RADIUS - REPEL_RADIUS);
        const bell  = 4 * t * (1 - t);
        const f     = AFTERGLOW_STRENGTH * bell * afterglow.strength / adist;
        ax -= adx * f;
        ay -= ady * f;
      }
    }

    // ── Velocity alignment (state modulated) ──────────────────────────────
    const k     = alignIdx[i];
    const n     = alignN[k] || 1;
    const avgVx = alignVx[k] / n;
    const avgVy = alignVy[k] / n;
    ax += (avgVx - p.vx) * ALIGN_K * stateMixAlign;
    ay += (avgVy - p.vy) * ALIGN_K * stateMixAlign;

    // ── Boids: cohesion + separation ──────────────────────────────────────
    const localCx   = alignCx[k] / n;
    const localCy   = alignCy[k] / n;
    const sepDx     = p.x - localCx;
    const sepDy     = p.y - localCy;
    const sepDistSq = sepDx * sepDx + sepDy * sepDy;

    ax += (localCx - p.x) * COHESION_K;
    ay += (localCy - p.y) * COHESION_K;

    if (sepDistSq > 0.01 && sepDistSq < SEPARATE_RADIUS_SQ) {
      const sepDist = Math.sqrt(sepDistSq);
      const sepF    = SEPARATE_K * (1 - sepDist / SEPARATE_RADIUS);
      ax += (sepDx / sepDist) * sepF;
      ay += (sepDy / sepDist) * sepF;
    }

    // ── Quirk twitches (suppressed during startle recovery) ───────────────
    if (twitchActive && !isRecovering) {
      ax += twitchAx * p.temperament;
      ay += twitchAy * p.temperament;
    }

    // ── Euler integration ─────────────────────────────────────────────────
    p.vx = (p.vx + ax) * DAMPING;
    p.vy = (p.vy + ay) * DAMPING;

    // ── Velocity cap + energy EMA (single sqrt) ───────────────────────────
    const velSq = p.vx * p.vx + p.vy * p.vy;
    const spd   = Math.sqrt(velSq);
    if (spd > VEL_CAP) {
      const inv = VEL_CAP / spd;
      p.vx *= inv;
      p.vy *= inv;
    }

    p.x += p.vx;
    p.y += p.vy;

    p.energy = Math.min(
      p.energy * ENERGY_DECAY + Math.min(spd, VEL_CAP) * (1 - ENERGY_DECAY),
      ENERGY_MAX,
    );
    totalEnergy += p.energy;
  }

  // Reset one-shot scatter flag after loop; advance wander cache tick
  gestureScatter = false;
  wanderTick++;

  const breathValue = Math.sin(bt);
  const excitement  = totalEnergy / particles.length / ENERGY_MAX;

  return {
    breathValue, excitement, mood,
    twitchFired: twitchActive,
    startleFired,
    behaviorState,
    circadian,
    startleResponseScale,
  };
}
