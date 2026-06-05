import type { MouseState } from './types';

export function createMouseState(): MouseState {
  return { x: -9999, y: -9999, speed: 0, active: false };
}

export function attachInputListeners(
  canvas: HTMLCanvasElement,
  mouse: MouseState,
): void {
  let prevX = 0;
  let prevY = 0;
  let prevTime = performance.now();

  function handleMove(clientX: number, clientY: number): void {
    const now = performance.now();
    const dt = Math.max(now - prevTime, 1);
    const dx = clientX - prevX;
    const dy = clientY - prevY;
    // Normalize to per-frame speed (assume 16ms frame) then EMA-smooth
    const rawSpeed = Math.sqrt(dx * dx + dy * dy) / dt * 16;
    mouse.speed = mouse.speed * 0.78 + rawSpeed * 0.22;
    mouse.x = clientX;
    mouse.y = clientY;
    mouse.active = true;
    prevX = clientX;
    prevY = clientY;
    prevTime = now;
  }

  function handleEnd(): void {
    mouse.active = false;
    mouse.x = -9999;
    mouse.y = -9999;
    mouse.speed = 0;
  }

  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  });

  canvas.addEventListener('mouseleave', handleEnd);

  canvas.addEventListener('touchmove', (e: TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) handleMove(t.clientX, t.clientY);
  }, { passive: false });

  canvas.addEventListener('touchend', handleEnd);
}
