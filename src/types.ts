export interface Particle {
  readonly id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hx: number;              // home position x — updated by physics each frame
  hy: number;              // home position y — updated by physics each frame
  phi: number;             // azimuthal angle — mutable, incremented for rotation
  readonly theta: number;  // tube angle — fixed at init
  readonly phase: number;  // per-particle phase for breathing + wander
  readonly dotRadius: number;  // base display radius (depth-cued at init)
  readonly colorIndex: number; // 0–3 → COLORS
  readonly isNear: boolean;    // cos(theta) > 0 — front depth layer
  energy: number;              // EMA of speed, drives glow intensity
}

export interface MouseState {
  x: number;
  y: number;
  speed: number;   // EMA-smoothed magnitude (px per ~16 ms frame)
  active: boolean;
}
