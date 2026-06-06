import { initParticles, repositionHomes } from './particles';
import { updateParticles } from './physics';
import { render } from './renderer';
import { createMouseState, attachInputListeners } from './mouse';
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

  window.addEventListener('resize', () => {
    resize();
    repositionHomes(particles, cssW, cssH);
  });

  const startTime = performance.now();

  function loop(timestamp: number): void {
    const time       = timestamp - startTime;
    const breathValue = updateParticles(particles, mouse, cssW / 2, cssH / 2, cssW, cssH, time);
    render(ctx, particles, cssW, cssH, breathValue);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main();
