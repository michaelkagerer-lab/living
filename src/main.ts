import { initParticles, repositionHomes } from './particles';
import { updateParticles } from './physics';
import { render } from './renderer';
import { createMouseState, attachInputListeners } from './mouse';
import type { CardBounds, Particle } from './types';

function getCardBounds(): CardBounds {
  const el = document.querySelector<HTMLElement>('.card');
  if (!el) {
    return {
      cx: window.innerWidth  / 2,
      cy: window.innerHeight / 2,
      halfW: 170,
      halfH: 100,
    };
  }
  const r = el.getBoundingClientRect();
  return {
    cx: r.left + r.width  / 2,
    cy: r.top  + r.height / 2,
    halfW: r.width  / 2,
    halfH: r.height / 2,
  };
}

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
    // setTransform resets the matrix before applying scale (safe to call repeatedly)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();

  let particles: Particle[] = initParticles(cssW, cssH);
  let card: CardBounds = { cx: cssW / 2, cy: cssH / 2, halfW: 170, halfH: 100 };

  const mouse = createMouseState();
  attachInputListeners(canvas, mouse);

  // Measure the real card size after the first paint
  requestAnimationFrame(() => {
    card = getCardBounds();
  });

  window.addEventListener('resize', () => {
    resize();
    repositionHomes(particles, cssW, cssH);
    card = getCardBounds();
  });

  const startTime = performance.now();

  function loop(timestamp: number): void {
    const time = timestamp - startTime;
    const cx = cssW / 2;
    const cy = cssH / 2;

    updateParticles(particles, mouse, card, cx, cy, time);
    render(ctx, particles, cssW, cssH);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main();
