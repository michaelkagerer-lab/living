import type { Particle, MouseState, CardBounds } from './types';
import {
  SPRING_K, DAMPING,
  REPEL_RADIUS, REPEL_STRENGTH, REPEL_SPEED_K,
  BREATH_FREQ, BREATH_AMP,
  CARD_PADDING, CARD_REPULSION,
  TAU,
} from './config';

const REPEL_RADIUS_SQ = REPEL_RADIUS * REPEL_RADIUS;

export function updateParticles(
  particles: Particle[],
  mouse: MouseState,
  card: CardBounds,
  cx: number,
  cy: number,
  time: number,
): void {
  // Padded card boundary for repulsion
  const cardL = card.cx - card.halfW - CARD_PADDING;
  const cardR = card.cx + card.halfW + CARD_PADDING;
  const cardT = card.cy - card.halfH - CARD_PADDING;
  const cardB = card.cy + card.halfH + CARD_PADDING;

  // Cache mouse state to avoid repeated property lookups in hot loop
  const mouseActive = mouse.active;
  const mouseX = mouse.x;
  const mouseY = mouse.y;
  // Velocity-based repulsion scale: fast mouse = larger wake
  const speedBoost = 1 + mouse.speed * REPEL_SPEED_K;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    let ax = 0;
    let ay = 0;

    // ── Breathing: scale the home position radially from canvas center ──
    // Each particle has its own phase offset to create a rolling wave across
    // the cloud rather than a lockstep pulse.
    const breathScale = 1 + BREATH_AMP * Math.sin(time * BREATH_FREQ * TAU + p.phase);
    const hxEff = cx + (p.hx - cx) * breathScale;
    const hyEff = cy + (p.hy - cy) * breathScale;

    // ── Spring attraction toward (breathing) home position ──
    ax += (hxEff - p.x) * SPRING_K;
    ay += (hyEff - p.y) * SPRING_K;

    // ── Mouse antigravity repulsion ──
    if (mouseActive) {
      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const distSq = dx * dx + dy * dy;
      if (distSq < REPEL_RADIUS_SQ && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const t = 1 - dist / REPEL_RADIUS;
        const force = REPEL_STRENGTH * t * t * speedBoost;
        const invDist = 1 / dist;
        ax += dx * invDist * force;
        ay += dy * invDist * force;
      }
    }

    // ── Soft card boundary repulsion ──
    // Particles inside the padded card zone are gently pushed outward from
    // the card center, preventing static clumping directly behind the text.
    if (p.x > cardL && p.x < cardR && p.y > cardT && p.y < cardB) {
      ax += (p.x - card.cx) * CARD_REPULSION;
      ay += (p.y - card.cy) * CARD_REPULSION;
    }

    // ── Semi-implicit Euler integration with velocity damping ──
    p.vx = (p.vx + ax) * DAMPING;
    p.vy = (p.vy + ay) * DAMPING;
    p.x += p.vx;
    p.y += p.vy;
  }
}
