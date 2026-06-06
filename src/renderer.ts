import type { Particle } from './types';
import {
  COLORS,
  LINE_DIST, MAX_LINES, LINE_ALPHA,
  CLOSE_LINE_DIST, CLOSE_LINE_ALPHA,
  GLOW_ALPHA, GLOW_RADIUS_FACTOR, ENERGY_GLOW_K,
  SPEED_SIZE_K,
  TORUS_R_MAJOR,
  TAU,
} from './config';

const LINE_DIST_SQ       = LINE_DIST       * LINE_DIST;
const CLOSE_LINE_DIST_SQ = CLOSE_LINE_DIST * CLOSE_LINE_DIST;

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

function drawBucket(
  ctx: CanvasRenderingContext2D,
  bucket: Particle[],
  radiusMult: number,
  energyBoost: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < bucket.length; i++) {
    const p  = bucket[i];
    const r  = p.dotRadius * radiusMult * (1 + p.energy * energyBoost);
    ctx.moveTo(p.x + r, p.y);
    ctx.arc(p.x, p.y, r, 0, TAU);
  }
  ctx.fill();
}

export function render(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  width: number,
  height: number,
  breathValue: number,
): void {
  if (width !== gridWidth) {
    grid.setDimensions(width);
    gridWidth = width;
  }

  // ── 1. Clear ──────────────────────────────────────────────────────────────
  ctx.clearRect(0, 0, width, height);

  // ── 2. Background breathing glow ──────────────────────────────────────────
  const minDim = Math.min(width, height);
  const glowR  = minDim * (TORUS_R_MAJOR + breathValue * 0.025);
  const grad   = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, glowR);
  grad.addColorStop(0, 'rgba(180,190,255,0.055)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // ── 3. Build spatial grid ─────────────────────────────────────────────────
  grid.clear();
  for (let i = 0; i < particles.length; i++) {
    grid.insert(i, particles[i].x, particles[i].y);
  }

  // ── 4. Two-tier constellation lines ───────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = '#9aa0a6';
  ctx.lineWidth   = 0.6;

  // Close bonds — bright tissue
  ctx.globalAlpha = CLOSE_LINE_ALPHA;
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
      if (dx * dx + dy * dy < CLOSE_LINE_DIST_SQ) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(n.x, n.y);
        drawn++;
      }
    }
  }
  ctx.stroke();

  // Loose web — faint long-range bonds
  ctx.globalAlpha = LINE_ALPHA;
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
      const d2 = dx * dx + dy * dy;
      if (d2 >= CLOSE_LINE_DIST_SQ && d2 < LINE_DIST_SQ) {
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

  // ── 6. Glow pre-pass (soft aura, energy-reactive) ─────────────────────────
  ctx.save();
  for (let c = 0; c < COLORS.length; c++) {
    if (farBuckets[c].length === 0 && nearBuckets[c].length === 0) continue;
    ctx.fillStyle = COLORS[c];

    ctx.globalAlpha = GLOW_ALPHA * 0.62;
    drawBucket(ctx, farBuckets[c],  GLOW_RADIUS_FACTOR, ENERGY_GLOW_K);

    ctx.globalAlpha = GLOW_ALPHA;
    drawBucket(ctx, nearBuckets[c], GLOW_RADIUS_FACTOR, ENERGY_GLOW_K);
  }
  ctx.restore();

  // ── 7. Solid particles — far layer (dimmed) then near layer (full) ────────
  ctx.save();
  for (let c = 0; c < COLORS.length; c++) {
    if (farBuckets[c].length === 0 && nearBuckets[c].length === 0) continue;
    ctx.fillStyle = COLORS[c];

    ctx.globalAlpha = 0.62;
    drawBucket(ctx, farBuckets[c],  1, SPEED_SIZE_K);

    ctx.globalAlpha = 1;
    drawBucket(ctx, nearBuckets[c], 1, SPEED_SIZE_K);
  }
  ctx.restore();
}
