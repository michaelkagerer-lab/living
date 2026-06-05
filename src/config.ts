// ---------- particle count ----------
export const PARTICLE_COUNT = 3000;

// ---------- color palette (Google brand) ----------
export const COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853'] as const;
// Cumulative weights for random color assignment (blue gets ~38%)
export const COLOR_CUMULATIVE = [0.38, 0.58, 0.78, 1.0] as const;

// ---------- torus shell geometry (fraction of min(W,H)) ----------
export const TORUS_R_MAJOR = 0.36;   // distance from screen center to tube center
export const TORUS_R_MINOR = 0.115;  // tube radius (controls shell thickness)
export const TORUS_Y_SQUISH = 0.62;  // oblique-projection y-foreshortening

// ---------- particle dot size (CSS px) ----------
export const DOT_MIN = 1.0;
export const DOT_MAX = 2.5;

// ---------- spring physics ----------
export const SPRING_K = 0.016;   // attraction toward home position
export const DAMPING  = 0.88;    // velocity drag per frame (1 = no drag)

// ---------- mouse repulsion ----------
export const REPEL_RADIUS   = 120;    // px radius of antigravity field
export const REPEL_STRENGTH = 6.0;   // base force magnitude
export const REPEL_SPEED_K  = 0.003; // extra force per unit of mouse speed

// ---------- idle breathing ----------
export const BREATH_FREQ = 0.00075; // cycles per ms  (~1.33 s period)
export const BREATH_AMP  = 0.055;   // fractional radial displacement

// ---------- card boundary ----------
export const CARD_PADDING   = 52;    // px of soft repulsion zone around card
export const CARD_REPULSION = 0.007; // per-px linear repulsion from card center

// ---------- constellation lines ----------
export const LINE_DIST  = 22;  // px — max distance to draw a connecting line
export const MAX_LINES  = 3;   // max lines drawn per particle per frame
export const LINE_ALPHA = 0.09;

// ---------- math ----------
export const TAU = Math.PI * 2;
