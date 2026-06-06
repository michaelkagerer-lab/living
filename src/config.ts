// ---------- particle count ----------
export const PARTICLE_COUNT = 3500;

// ---------- color palette (Google brand) ----------
export const COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853'] as const;
export const COLOR_CUMULATIVE = [0.38, 0.58, 0.78, 1.0] as const;

// ---------- torus shell geometry (fraction of min(W,H)) ----------
export const TORUS_R_MAJOR = 0.38;   // ring radius from center
export const TORUS_R_MINOR = 0.17;   // tube thickness — bigger = fuzzier, more diffuse
export const TORUS_Y_SQUISH = 0.60;  // oblique-projection foreshortening

// ---------- particle dot size (CSS px) ----------
export const DOT_MIN = 0.9;
export const DOT_MAX = 2.8;

// ---------- spring physics ----------
export const SPRING_K = 0.012;  // softer spring = more float and wander
export const DAMPING  = 0.90;   // higher = more fluid inertia

// ---------- mouse repulsion ----------
export const REPEL_RADIUS   = 140;
export const REPEL_STRENGTH = 7.0;
export const REPEL_SPEED_K  = 0.004;

// ---------- idle breathing (dual-frequency for organic irregularity) ----------
export const BREATH_FREQ = 0.00060;  // primary cycles/ms  (~1.67 s period)
export const BREATH_AMP  = 0.075;    // radial displacement fraction

// ---------- organic wander field ----------
export const NOISE_STRENGTH = 0.28;   // wander force magnitude
export const WANDER_SCALE   = 0.0038; // spatial frequency of the flow field
export const WANDER_SPEED   = 0.00022; // how fast the field evolves

// ---------- constellation lines ----------
export const LINE_DIST  = 26;
export const MAX_LINES  = 3;
export const LINE_ALPHA = 0.07;

// ---------- math ----------
export const TAU = Math.PI * 2;
