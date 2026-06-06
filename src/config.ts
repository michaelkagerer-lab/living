// ---------- particle count ----------
export const PARTICLE_COUNT = 2800;

// ---------- color palette (Google brand) ----------
export const COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853'] as const;
export const COLOR_CUMULATIVE = [0.38, 0.58, 0.78, 1.0] as const;

// ---------- torus shell geometry (fraction of min(W,H)) ----------
export const TORUS_R_MAJOR = 0.38;
export const TORUS_R_MINOR = 0.17;
export const TORUS_Y_SQUISH = 0.60;

// ---------- particle dot size (CSS px) ----------
export const DOT_MIN = 0.9;
export const DOT_MAX = 3.2;

// ---------- spring physics ----------
export const SPRING_K = 0.016;
export const DAMPING  = 0.87;

// ---------- velocity cap (prevents physics collapse on fast mouse) ----------
export const VEL_CAP    = 13;
export const VEL_CAP_SQ = 169;

// ---------- mouse repulsion ----------
export const REPEL_RADIUS   = 140;
export const REPEL_STRENGTH = 5.5;
export const REPEL_SPEED_K  = 0.004;
export const SPEED_BOOST_CAP = 2.0;

// ---------- mouse curiosity / attraction zone ----------
export const ATTRACT_RADIUS   = 300;
export const ATTRACT_STRENGTH = 0.35;

// ---------- idle breathing ----------
export const BREATH_FREQ = 0.00060;
export const BREATH_AMP  = 0.090;

// ---------- slow 3D rotation ----------
export const ROTATION_SPEED = 0.0003;

// ---------- perspective tilt oscillation ----------
export const TILT_SPEED = 0.000055;
export const TILT_AMP   = 0.16;

// ---------- device orientation / desktop parallax ----------
export const TILT_DEVICE_AMP = 0.25;

// ---------- organic wander field ----------
export const NOISE_STRENGTH        = 0.32;
export const WANDER_SCALE          = 0.0038;
export const WANDER_SPEED          = 0.00022;
export const WANDER_CACHE_INTERVAL = 3;   // recompute wander every N frames (66% trig reduction)

// ---------- local velocity alignment (typed-array grid) ----------
export const ALIGN_K         = 0.006;
export const ALIGN_MAX_CELLS = 10_000;

// ---------- boids: cohesion + separation ----------
export const COHESION_K        = 0.003;
export const SEPARATE_RADIUS   = 10;
export const SEPARATE_RADIUS_SQ = 100;
export const SEPARATE_K        = 0.10;

// ---------- autonomous mood state (curious-biased, anxious-tipped) ----------
export const MOOD_FREQ = 0.0000115;
export const MOOD_AMP  = 0.50;
export const MOOD_BIAS = 0.25;

// ---------- heartbeat CPG ----------
export const HEARTBEAT_FREQ = 0.00095;
export const HEARTBEAT_AMP  = 0.016;

// ---------- approach-speed coupling / startle ----------
export const STARTLE_K               = 0.005;
export const AGGRESSION_CAP          = 1.5;
export const STARTLE_TRIGGER_THRESHOLD = 0.5;
export const STARTLE_RECOVERY_MS     = 3_000;

// ---------- random quirk twitches ----------
export const TWITCH_INTERVAL  = 9000;
export const TWITCH_THRESHOLD = 0.82;
export const TWITCH_STRENGTH  = 0.35;

// ---------- gaze target (autonomous idle attention) ----------
export const GAZE_INTERVAL_MS = 15_000;
export const GAZE_LERP_RATE   = 0.0004;
export const GAZE_RADIUS      = 180;
export const GAZE_STRENGTH    = 0.012;

// ---------- gesture vocabulary ----------
export const GESTURE_SPIN_FRAMES  = 90;
export const GESTURE_SPIN_MULT    = 5;
export const HOVER_GAZE_SNAP_MS   = 4_000;
export const HOVER_GAZE_HOLD_MS   = 25_000;

// ---------- mouse afterglow (memory of presence) ----------
export const AFTERGLOW_DURATION_MS = 4_000;
export const AFTERGLOW_STRENGTH    = 0.22;

// ---------- trust accumulation (patient stillness rewarded) ----------
export const TRUST_SPEED_THRESHOLD = 0.5;
export const TRUST_BUILD_MS        = 2_000;
export const TRUST_DECAY_MS        = 1_000;
export const TRUST_ATTRACT_SCALE   = 1.5;

// ---------- particle energy — drives glow and size reactivity ----------
export const ENERGY_DECAY  = 0.92;
export const ENERGY_MAX    = 1.5;
export const ENERGY_GLOW_K = 0.04;
export const SPEED_SIZE_K  = 0.08;

// ---------- glow pre-pass ----------
export const GLOW_ALPHA            = 0.045;
export const GLOW_RADIUS_FACTOR    = 2.5;
export const GLOW_ENERGY_THRESHOLD = 0.08;

// ---------- velocity streaks ----------
export const STREAK_LEN_K = 3.5;
export const STREAK_ALPHA = 0.18;

// ---------- constellation lines ----------
export const LINE_DIST  = 24;
export const LINE_ALPHA = 0.07;
export const MAX_LINES  = 3;

// ---------- behavioral state machine ----------
export const STATE_MOOD_CURIOUS_THRESHOLD = 0.30;
export const STATE_MOOD_RESTING_THRESHOLD = -0.10;
export const STATE_STARTLE_HOLD_MS        = 3_500;
export const STATE_CAUTIOUS_HOLD_MS       = 6_000;
export const STATE_PLAYFUL_TRUST_MIN      = 0.70;
export const STATE_PLAYFUL_MOOD_MIN       = 0.50;
export const STATE_TRANSITION_DAMP        = 0.04;

// ---------- startle habituation / sensitization ----------
export const HABITUATION_DECAY_MS    = 45_000;
export const HABITUATION_MAX_COUNT   = 6;
export const HABITUATION_MIN_SCALE   = 0.25;
export const SENSITIZATION_WINDOW_MS = 2_000;
export const SENSITIZATION_BOOST     = 1.8;

// ---------- leader / follower social structure ----------
export const LEADER_FRACTION     = 0.01;
export const LEADER_WANDER_MULT  = 2.2;
export const LEADER_SPRING_MULT  = 0.55;
export const LEADER_ALIGN_WEIGHT = 4.0;
export const LEADER_GAZE_MULT    = 2.5;

// ---------- circadian rest/activity cycle (~3.5 min period) ----------
export const CIRCADIAN_FREQ     = 1 / 210_000;
export const CIRCADIAN_AMP      = 0.40;
export const CIRCADIAN_BIAS     = 0.10;
export const CIRCADIAN_WANDER_K = 1.0;
export const CIRCADIAN_BREATH_K = 0.30;

// ---------- mouse trajectory prediction ----------
export const PREDICT_LEAD_MS   = 380;
export const PREDICT_RADIUS    = 220;
export const PREDICT_STRENGTH  = 0.18;

// ---------- mood color expression ----------
export const MOOD_TINT_STRENGTH  = 0.28;
export const MOOD_TINT_LERP_RATE = 0.015;

// ---------- audio harmonic structure ----------
export const DRONE_BASE_FREQ      = 110;
export const DRONE_INTERVAL_CALM  = 1.4983;
export const DRONE_INTERVAL_TENSE = 1.1892;
export const DRONE_INTERVAL_DRIFT = 0.0060;
export const DRONE_LFO_FREQ       = 0.07;
export const DRONE_LFO_AMP        = 0.40;
export const DRONE_VOICE2_GAIN    = 0.012;

// ---------- math ----------
export const TAU = Math.PI * 2;
