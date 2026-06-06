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
export const DOT_MAX = 3.2;   // larger front-face particles

// ---------- spring physics ----------
export const SPRING_K = 0.016;
export const DAMPING  = 0.87;

// ---------- mouse repulsion ----------
export const REPEL_RADIUS   = 140;
export const REPEL_STRENGTH = 5.5;
export const REPEL_SPEED_K  = 0.004;

// ---------- mouse curiosity / attraction zone ----------
export const ATTRACT_RADIUS   = 300;
export const ATTRACT_STRENGTH = 0.35;

// ---------- idle breathing ----------
export const BREATH_FREQ = 0.00060;
export const BREATH_AMP  = 0.090;  // more visible breathing

// ---------- slow 3D rotation ----------
export const ROTATION_SPEED = 0.0003;

// ---------- perspective tilt oscillation ----------
export const TILT_SPEED = 0.000055;
export const TILT_AMP   = 0.16;    // more pronounced nod

// ---------- organic wander field ----------
export const NOISE_STRENGTH = 0.32;  // more expressive wander
export const WANDER_SCALE   = 0.0038;
export const WANDER_SPEED   = 0.00022;

// ---------- local velocity alignment (emergent flocking) ----------
export const ALIGN_K = 0.006;

// ---------- autonomous mood state (curious-biased, anxious-tipped) ----------
// Dual-frequency oscillator: ~90-sec period, biased toward curiosity
export const MOOD_FREQ = 0.0000115; // rad/ms — ~90-second mood cycle
export const MOOD_AMP  = 0.50;      // how strongly mood modulates behaviour
export const MOOD_BIAS = 0.25;      // centre > 0 = biased curious

// ---------- heartbeat CPG (Central Pattern Generator) ----------
// Self-sustaining ~57 BPM pulse layered on top of the slower breath
export const HEARTBEAT_FREQ = 0.00095; // rad/ms — ≈57 BPM
export const HEARTBEAT_AMP  = 0.016;   // 1.6% pulse amplitude

// ---------- approach-speed coupling / startle ----------
export const STARTLE_K = 0.005;   // inward contraction strength

// ---------- random quirk twitches ----------
export const TWITCH_INTERVAL  = 9000;  // ms between twitch-check slots
export const TWITCH_THRESHOLD = 0.82;  // hash value above which twitch fires
export const TWITCH_STRENGTH  = 0.35;  // impulse magnitude (scales by temperament)

// ---------- particle energy — drives glow and size reactivity ----------
export const ENERGY_DECAY  = 0.92;
export const ENERGY_MAX    = 1.5;
export const ENERGY_GLOW_K = 0.04;
export const SPEED_SIZE_K  = 0.08;

// ---------- glow pre-pass ----------
export const GLOW_ALPHA         = 0.045;  // slightly richer aura
export const GLOW_RADIUS_FACTOR = 2.5;

// ---------- velocity streaks (juice / motion trails) ----------
export const STREAK_LEN_K = 3.5;   // streak length = dotRadius * energy * this
export const STREAK_ALPHA = 0.18;

// ---------- constellation lines ----------
export const LINE_DIST  = 24;
export const LINE_ALPHA = 0.07;
export const MAX_LINES  = 3;

// ---------- math ----------
export const TAU = Math.PI * 2;
