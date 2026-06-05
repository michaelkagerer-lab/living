import type { Particle } from './types';
import { COLORS, LINE_DIST, MAX_LINES, LINE_ALPHA, TAU } from './config';

const LINE_DIST_SQ = LINE_DIST * LINE_DIST;

// ── Spatial hash grid for O(1) neighborhood queries ─────────────────────────
// Uses a Map<number, number[]> (integer cell key → list of particle indices).
// Rebuilt entirely each frame in O(N). Scratch array avoids per-query allocs.

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

  // Returns a SHARED scratch array — caller must not hold the reference
  // across a subsequent call to getNeighbors.
  getNeighbors(x: number, y: number): readonly number[] {
    this.scratch.length = 0;
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cell = this.cells.get((gy + dy) * this.cols + (gx + dx));
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            this.scratch.push(cell[i]);
          }
        }
      }
    }
    return this.scratch;
  }
}

// Module-level singletons — recreated only on canvas resize
let grid = new SpatialGrid(LINE_DIST);
let gridWidth = 0;

// Pre-allocated color bucket arrays (grow once, then stable)
const buckets: Particle[][] = COLORS.map(() => []);

export function render(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  width: number,
  height: number,
): void {
  // Reinitialise grid if canvas was resized
  if (width !== gridWidth) {
    grid.setDimensions(width);
    gridWidth = width;
  }

  // ── 1. Clear ──────────────────────────────────────────────────────────────
  ctx.clearRect(0, 0, width, height);

  // ── 2. Build spatial grid ─────────────────────────────────────────────────
  grid.clear();
  for (let i = 0; i < particles.length; i++) {
    grid.insert(i, particles[i].x, particles[i].y);
  }

  // ── 3. Constellation lines (drawn beneath particles) ──────────────────────
  // Each unique pair (p, n) is drawn exactly once by requiring n.id > p.id.
  ctx.save();
  ctx.globalAlpha = LINE_ALPHA;
  ctx.strokeStyle = '#9aa0a6';
  ctx.lineWidth = 0.6;
  ctx.beginPath();

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const neighbors = grid.getNeighbors(p.x, p.y);
    let drawn = 0;
    for (let j = 0; j < neighbors.length && drawn < MAX_LINES; j++) {
      const nIdx = neighbors[j];
      if (nIdx === undefined || nIdx <= p.id) continue; // draw each pair once
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

  // ── 4. Particles — batched by color (4 fillStyle changes total) ───────────
  // Sort particles into color buckets without allocating new arrays.
  for (let c = 0; c < buckets.length; c++) buckets[c].length = 0;
  for (let i = 0; i < particles.length; i++) {
    buckets[particles[i].colorIndex].push(particles[i]);
  }

  ctx.save();
  ctx.globalAlpha = 1;

  for (let c = 0; c < COLORS.length; c++) {
    const bucket = buckets[c];
    if (bucket.length === 0) continue;
    ctx.fillStyle = COLORS[c];
    ctx.beginPath();
    for (let i = 0; i < bucket.length; i++) {
      const p = bucket[i];
      // moveTo before arc prevents the path builder connecting arcs with lines
      ctx.moveTo(p.x + p.dotRadius, p.y);
      ctx.arc(p.x, p.y, p.dotRadius, 0, TAU);
    }
    ctx.fill();
  }

  ctx.restore();
}
