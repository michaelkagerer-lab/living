import { initParticles, repositionHomes } from './particles';
import { updateParticles } from './physics';
import { render } from './renderer';
import { createMouseState, attachInputListeners } from './mouse';
import { OrganismAudio } from './audio';
import type { Particle } from './types';

function main(): void {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  let cssW = window.innerWidth;
  let cssH = window.innerHeight;

  function resize(): void {
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();

  let particles: Particle[] = initParticles(cssW, cssH);

  const mouse = createMouseState();
  attachInputListeners(canvas, mouse);

  // ── Device orientation / desktop parallax tilt ───────────────────────────
  const tilt = { x: 0, y: 0 };
  let hasDeviceOrientation = false;

  window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
    hasDeviceOrientation = true;
    tilt.x = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 40));
    tilt.y = Math.max(-1, Math.min(1, (e.beta  ?? 0) / 40));
  });

  // ── Audio ─────────────────────────────────────────────────────────────────
  const audio = new OrganismAudio();
  let prevBreathValue = 0;

  canvas.addEventListener('mousemove', () => audio.init(), { once: true });
  canvas.addEventListener('touchstart', () => audio.init(), { once: true });

  const muteBtn = document.getElementById('mute') as HTMLButtonElement | null;
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      audio.init();
      audio.toggle();
      muteBtn.textContent = audio.muted ? '🔇' : '🔊';
    });
  }

  window.addEventListener('resize', () => {
    resize();
    repositionHomes(particles, cssW, cssH);
  });

  const startTime = performance.now();
  // Cap to 30fps on ≤2-core devices to halve render cost
  const targetInterval = (navigator.hardwareConcurrency ?? 4) <= 2 ? 33 : 0;
  let lastFrameTime = 0;
  let rafId = 0;

  function loop(timestamp: number): void {
    if (targetInterval > 0 && timestamp - lastFrameTime < targetInterval) {
      rafId = requestAnimationFrame(loop);
      return;
    }
    lastFrameTime = timestamp;
    const time = timestamp - startTime;

    // Desktop parallax fallback — mouse offset from center → gentle tilt
    if (!hasDeviceOrientation && mouse.active) {
      tilt.x += ((mouse.x - cssW / 2) / cssW * 0.6 - tilt.x) * 0.04;
      tilt.y += ((mouse.y - cssH / 2) / cssH * 0.4 - tilt.y) * 0.04;
    } else if (!hasDeviceOrientation) {
      tilt.x *= 0.98;
      tilt.y *= 0.98;
    }

    const {
      breathValue, excitement, mood,
      twitchFired, startleFired,
      behaviorState, startleResponseScale,
    } = updateParticles(particles, mouse, cssW / 2, cssH / 2, cssW, cssH, time, tilt);

    audio.update(
      breathValue, excitement, mood,
      twitchFired, startleFired,
      prevBreathValue,
      behaviorState, startleResponseScale,
    );
    prevBreathValue = breathValue;

    render(ctx, particles, cssW, cssH, breathValue, excitement, mood, behaviorState);
    rafId = requestAnimationFrame(loop);
  }

  // Pause the loop when the tab is hidden — saves 100% CPU in background
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else {
      rafId = requestAnimationFrame(loop);
    }
  });

  rafId = requestAnimationFrame(loop);
}

main();
