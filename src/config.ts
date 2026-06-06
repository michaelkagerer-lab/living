// ---------- particle count ----------
export const PARTICLE_COUNT = 3500;

// ---------- color palette (Google brand) ----------
export const COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853'] as const;
export const COLOR_CUMULATIVE = [0.38, 0.58, 0.78, 1.0] as const;

// ---------- torus shell geometry (fraction of min(W,H)) ----------
export const TORUS_R_MAJOR = 0.38;
export const TORUS_R_MINOR = 0.17;
export const TORUS_Y_SQUISH = 0.60;

// ---------- particle dot size (CSS px) ----------
export const DOT_MIN = 0.9;
export const DOT_MAX = 2.8;

// ---------- spring physics ----------
export const SPRING_K = 0.016;  // stronger hold keeps torus shape under stress
export const DAMPING  = 0.87;   // more velocity decay, less runaway

// ---------- mouse repulsion ----------
export const REPEL_RADIUS   = 140;
export const REPEL_STRENGTH = 5.5;  // less explosive than 7.0
export const REPEL_SPEED_K  = 0.004;

// ---------- mouse curiosity / attraction zone ----------
// Bell-shaped force: zero at REPEL_RADIUS, peaks at midpoint, zero at ATTRACT_RADIUS
// Eliminates the soap-bubble ring artifact caused by the old hard boundary
export const ATTRACT_RADIUS   = 300;
export const ATTRACT_STRENGTH = 0.35;  // subtle lean — reads as awareness, not magnet

// ---------- idle breathing ----------
export const BREATH_FREQ = 0.00060;
export const BREATH_AMP  = 0.075;

// ---------- slow 3D rotation ----------
export const ROTATION_SPEED = 0.0003; // rad/frame — full orbit in ~8 min

// ---------- perspective tilt oscillation ----------
export const TILT_SPEED = 0.000055;  // rad/ms — makes the torus appear to nod
export const TILT_AMP   = 0.12;

// ---------- organic wander field ----------
export const NOISE_STRENGTH = 0.28;
export const WANDER_SCALE   = 0.0038;
export const WANDER_SPEED   = 0.00022;

// ---------- local velocity alignment (emergent flocking) ----------
export const ALIGN_K = 0.006;  // reduced from 0.014 — prevents escape-velocity feedback

// ---------- particle energy — drives glow and size reactivity ----------
export const ENERGY_DECAY  = 0.92;
export const ENERGY_MAX    = 1.5;   // hard cap — prevents unbounded blob growth
export const ENERGY_GLOW_K = 0.04;  // was 0.09 — tighter glow modulation
export const SPEED_SIZE_K  = 0.08;  // was 0.25 — very subtle size swell

// ---------- glow pre-pass ----------
export const GLOW_ALPHA         = 0.035;  // was 0.05
export const GLOW_RADIUS_FACTOR = 2.5;    // was 4.5 — max halo radius ≈ 7px

// ---------- constellation lines ----------
export const LINE_DIST  = 24;   // px — slightly tighter than previous 28px
export const LINE_ALPHA = 0.07;
export const MAX_LINES  = 3;

// ---------- math ----------
export const TAU = Math.PI * 2;
