import type { Particle, BehaviorState } from './types';
import {
  COLORS,
  LINE_DIST, MAX_LINES, LINE_ALPHA,
  GLOW_ALPHA, GLOW_RADIUS_FACTOR, ENERGY_GLOW_K, GLOW_ENERGY_THRESHOLD,
  SPEED_SIZE_K,
  STREAK_LEN_K, STREAK_ALPHA,
  TORUS_R_MAJOR,
  MOOD_TINT_STRENGTH, MOOD_TINT_LERP_RATE,
  TAU,
} from './config';

const LINE_DIST_SQ = LINE_DIST * LINE_DIST;

// ── Spatial hash grid ─────────────────────────────────────────────────────────
class SpatialGrid {
  private readonly cells = new Map<number, number[]>();
  private readonly cellSize: number;
  private cols = 1;
  private readonly usedKeys: number[] = [];
  private readonly scratch: number[] = [];

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  setDimensions(width: number): void {
    this.cols = Math.ceil(width / this.cellSize) + 2;
  }

  clear(): void {
    for (const k of this.usedKeys) {
      const cell = this.cells.get(k);
      if (cell) cell.length = 0;
    }
    this.usedKeys.length = 0;
  }

  insert(index: number, x: number, y: number): void {
    const key = Math.floor(y / this.cellSize) * this.cols
              + Math.floor(x / this.cellSize);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    if (cell.length === 0) this.usedKeys.push(key);
    cell.push(index);
  }

  getNeighbors(x: number, y: number): readonly number[] {
    this.scratch.length = 0;
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cell = this.cells.get((gy + dy) * this.cols + (gx + dx));
        if (cell) {
          for (let i = 0; i < cell.length; i++) this.scratch.push(cell[i]);
        }
      }
    }
    return this.scratch;
  }
}

let grid = new SpatialGrid(LINE_DIST);
let gridWidth = 0;

// 8 depth×color buckets: [far_0, far_1, far_2, far_3, near_0, near_1, near_2, near_3]
const farBuckets:  Particle[][] = COLORS.map(() => []);
const nearBuckets: Particle[][] = COLORS.map(() => []);

// ── Mood tint state (lerped each frame) ───────────────────────────────────────
let tintR = 0, tintG = 0, tintB = 0, tintA = 0;

function drawBucket(
  ctx: CanvasRenderingContext2D,
  bucket: Particle[],
  radiusMult: number,
  energyBoost: number,
  minEnergy = 0,
): void {
  ctx.beginPath();
  for (let i = 0; i < bucket.length; i++) {
    const p = bucket[i];
    if (p.energy < minEnergy) continue;
    const r = p.dotRadius * radiusMult * (1 + p.energy * energyBoost);
    ctx.moveTo(p.x + r, p.y);
    ctx.arc(p.x, p.y, r, 0, TAU);
  }
  ctx.fill();
}

// Tinted version of drawBucket — second pass for mood expression
function drawBucketTinted(
  ctx: CanvasRenderingContext2D,
  bucket: Particle[],
  radiusMult: number,
  energyBoost: number,
  tA: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < bucket.length; i++) {
    const p = bucket[i];
    if (p.energy < GLOW_ENERGY_THRESHOLD) continue;
    const r = p.dotRadius * radiusMult * (1 + p.energy * energyBoost);
    ctx.moveTo(p.x + r, p.y);
    ctx.arc(p.x, p.y, r, 0, TAU);
  }
  ctx.globalAlpha = tA * 0.75;
  ctx.fill();
}

// Velocity streak pass — comet tails for energised particles
function drawStreaks(ctx: CanvasRenderingContext2D, bucket: Particle[]): void {
  ctx.beginPath();
  for (let i = 0; i < bucket.length; i++) {
    const p = bucket[i];
    if (p.energy < 0.4) continue;
    const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (spd < 0.01) continue;
    const len = p.dotRadius * p.energy * STREAK_LEN_K;
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - (p.vx / spd) * len, p.y - (p.vy / spd) * len);
  }
  ctx.stroke();
}

export function render(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  width: number,
  height: number,
  breathValue: number,
  excitement: number,
  mood: number,
  behaviorState: BehaviorState,
): void {
  if (width !== gridWidth) {
    grid.setDimensions(width);
    gridWidth = width;
  }

  // ── 1. Clear ──────────────────────────────────────────────────────────────
  ctx.clearRect(0, 0, width, height);

  // ── 2. Background breathing glow (excitement-reactive: cool→warm) ─────────
  const minDim = Math.min(width, height);
  const glowR  = minDim * (TORUS_R_MAJOR + breathValue * 0.025);
  const r = Math.round(180 + excitement * 75);
  const g = Math.round(190 + excitement * 10);
  const b = Math.round(255 - excitement * 85);
  const a = (0.055 + excitement * 0.015).toFixed(3);
  const grad   = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, glowR);
  grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // ── Mood tint: compute target and lerp ────────────────────────────────────
  let targetR = 0, targetG = 0, targetB = 0, targetA = 0;
  switch (behaviorState) {
    case 'STARTLED': targetR = 255; targetG =  60; targetB =  60; targetA = MOOD_TINT_STRENGTH; break;
    case 'CAUTIOUS': targetR = 255; targetG = 120; targetB =  60; targetA = MOOD_TINT_STRENGTH * 0.5; break;
    case 'RESTING':  targetR =  80; targetG = 140; targetB = 255; targetA = MOOD_TINT_STRENGTH * 0.5; break;
    case 'PLAYFUL':  targetR = 255; targetG = 220; targetB =  80; targetA = MOOD_TINT_STRENGTH * 0.6; break;
    case 'CURIOUS':  targetA = 0; break;
  }
  tintR += (targetR - tintR) * MOOD_TINT_LERP_RATE;
  tintG += (targetG - tintG) * MOOD_TINT_LERP_RATE;
  tintB += (targetB - tintB) * MOOD_TINT_LERP_RATE;
  tintA += (targetA - tintA) * MOOD_TINT_LERP_RATE;

  // ── 3. Build spatial grid ─────────────────────────────────────────────────
  grid.clear();
  for (let i = 0; i < particles.length; i++) {
    grid.insert(i, particles[i].x, particles[i].y);
  }

  // ── 4. Constellation lines ────────────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = LINE_ALPHA;
  ctx.strokeStyle = '#9aa0a6';
  ctx.lineWidth   = 0.6;
  ctx.beginPath();

  for (let i = 0; i < particles.length; i++) {
    const p         = particles[i];
    const neighbors = grid.getNeighbors(p.x, p.y);
    let drawn = 0;
    for (let j = 0; j < neighbors.length && drawn < MAX_LINES; j++) {
      const nIdx = neighbors[j];
      if (nIdx === undefined || nIdx <= p.id) continue;
      const n = particles[nIdx];
      if (!n) continue;
      const dx = n.x - p.x;
      const dy = n.y - p.y;
      if (dx * dx + dy * dy < LINE_DIST_SQ) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(n.x, n.y);
        drawn++;
      }
    }
  }

  ctx.stroke();
  ctx.restore();

  // ── 5. Sort into depth × color buckets ───────────────────────────────────
  for (let c = 0; c < COLORS.length; c++) {
    farBuckets[c].length  = 0;
    nearBuckets[c].length = 0;
  }
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    (p.isNear ? nearBuckets : farBuckets)[p.colorIndex].push(p);
  }

  // ── 6. Glow pre-pass (soft aura, energy-reactive + mood tint) ────────────
  ctx.save();
  for (let c = 0; c < COLORS.length; c++) {
    if (farBuckets[c].length === 0 && nearBuckets[c].length === 0) continue;

    ctx.fillStyle  = COLORS[c];
    ctx.globalAlpha = GLOW_ALPHA * 0.75;
    drawBucket(ctx, farBuckets[c],  GLOW_RADIUS_FACTOR, ENERGY_GLOW_K, GLOW_ENERGY_THRESHOLD);

    ctx.globalAlpha = GLOW_ALPHA;
    drawBucket(ctx, nearBuckets[c], GLOW_RADIUS_FACTOR, ENERGY_GLOW_K, GLOW_ENERGY_THRESHOLD);

    // Mood tint overlay on glow pass only
    if (tintA > 0.005) {
      ctx.fillStyle = `rgb(${Math.round(tintR)},${Math.round(tintG)},${Math.round(tintB)})`;
      drawBucketTinted(ctx, farBuckets[c],  GLOW_RADIUS_FACTOR, ENERGY_GLOW_K, tintA * 0.75);
      drawBucketTinted(ctx, nearBuckets[c], GLOW_RADIUS_FACTOR, ENERGY_GLOW_K, tintA);
    }
  }
  ctx.restore();

  // ── 7. Velocity streaks — motion trails for energised particles ──────────────
  ctx.save();
  ctx.globalAlpha = STREAK_ALPHA;
  ctx.lineWidth   = 0.8;
  for (let c = 0; c < COLORS.length; c++) {
    ctx.strokeStyle = COLORS[c];
    drawStreaks(ctx, farBuckets[c]);
    drawStreaks(ctx, nearBuckets[c]);
  }
  ctx.restore();

  // ── 8. Solid particles — far layer (slightly dimmed) then near layer (full) ─
  ctx.save();
  for (let c = 0; c < COLORS.length; c++) {
    if (farBuckets[c].length === 0 && nearBuckets[c].length === 0) continue;
    ctx.fillStyle = COLORS[c];

    ctx.globalAlpha = 0.75;
    drawBucket(ctx, farBuckets[c],  1, SPEED_SIZE_K);

    ctx.globalAlpha = 1;
    drawBucket(ctx, nearBuckets[c], 1, SPEED_SIZE_K);
  }
  ctx.restore();

  // Suppress unused variable warning for mood (used indirectly via behaviorState)
  void mood;
}
