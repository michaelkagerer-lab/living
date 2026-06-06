export interface Particle {
  readonly id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hx: number;             // home position x — recomputed on resize
  hy: number;             // home position y — recomputed on resize
  readonly phi: number;   // azimuthal angle in torus (stored for resize)
  readonly theta: number; // tube angle in torus   (stored for resize)
  readonly phase: number; // per-particle phase — breathing + wander offset
  readonly dotRadius: number;  // display radius in CSS px (depth-cued at init)
  readonly colorIndex: number; // 0–3, indexes into COLORS
}

export interface MouseState {
  x: number;
  y: number;
  speed: number;   // EMA-smoothed magnitude (px per ~16 ms frame)
  active: boolean; // false when cursor is outside canvas
}
