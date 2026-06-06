import type { MouseState } from './types';

// Module-local path ring buffer for gesture detection
const PATH_SIZE = 80;
const pathX = new Float32Array(PATH_SIZE);
const pathY = new Float32Array(PATH_SIZE);
const pathT = new Float32Array(PATH_SIZE);
let pathHead = 0;
let pathFull = false;

function detectGesture(cx: number, cy: number): MouseState['gesture'] {
  const now = performance.now();
  const count = pathFull ? PATH_SIZE : pathHead;
  if (count < 10) return 'none';

  // Shake: > 4 x-direction reversals in last 400ms
  let reversals = 0;
  let prevDx = 0;
  for (let i = 1; i < count; i++) {
    const idx     = (pathHead - 1 - i + PATH_SIZE) % PATH_SIZE;
    const idxPrev = (idx - 1 + PATH_SIZE) % PATH_SIZE;
    if (now - pathT[idx] > 400) break;
    const dx = pathX[idx] - pathX[idxPrev];
    if (dx !== 0 && prevDx !== 0 && Math.sign(dx) !== Math.sign(prevDx)) reversals++;
    prevDx = dx;
  }
  if (reversals > 4) return 'shake';

  // Circle: cumulative signed angle > 1.5π in last 1800ms
  let totalAngle = 0;
  let prevAngle  = Math.atan2(
    pathY[(pathHead - 1 + PATH_SIZE) % PATH_SIZE] - cy,
    pathX[(pathHead - 1 + PATH_SIZE) % PATH_SIZE] - cx,
  );
  for (let i = 1; i < count; i++) {
    const idx = (pathHead - 1 - i + PATH_SIZE) % PATH_SIZE;
    if (now - pathT[idx] > 1800) break;
    const ang = Math.atan2(pathY[idx] - cy, pathX[idx] - cx);
    let d = ang - prevAngle;
    if (d >  Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    totalAngle += d;
    prevAngle   = ang;
  }
  if (Math.abs(totalAngle) > Math.PI * 1.5) return 'circle';

  return 'none';
}

export function createMouseState(): MouseState {
  return {
    x: -9999, y: -9999, speed: 0, vx: 0, vy: 0, active: false,
    lastActiveX: -9999, lastActiveY: -9999, justLeft: false,
    gesture: 'none',
  };
}

export function attachInputListeners(
  canvas: HTMLCanvasElement,
  mouse: MouseState,
): void {
  let prevX    = 0;
  let prevY    = 0;
  let prevTime = performance.now();

  function handleMove(clientX: number, clientY: number): void {
    const now = performance.now();
    const dt  = Math.max(now - prevTime, 1);
    const dx  = clientX - prevX;
    const dy  = clientY - prevY;
    const rawSpeed = Math.sqrt(dx * dx + dy * dy) / dt * 16;
    mouse.speed  = mouse.speed * 0.78 + rawSpeed * 0.22;
    mouse.vx     = mouse.vx * 0.78 + (dx / dt * 16) * 0.22;
    mouse.vy     = mouse.vy * 0.78 + (dy / dt * 16) * 0.22;
    mouse.x      = clientX;
    mouse.y      = clientY;
    mouse.active = true;
    prevX    = clientX;
    prevY    = clientY;
    prevTime = now;

    // Push to ring buffer and detect gesture
    pathX[pathHead] = clientX;
    pathY[pathHead] = clientY;
    pathT[pathHead] = now;
    pathHead = (pathHead + 1) % PATH_SIZE;
    if (pathHead === 0) pathFull = true;

    mouse.gesture = detectGesture(clientX, clientY);
  }

  function handleEnd(): void {
    if (mouse.active) {
      mouse.lastActiveX = mouse.x;
      mouse.lastActiveY = mouse.y;
      mouse.justLeft    = true;
    }
    mouse.active  = false;
    mouse.x       = -9999;
    mouse.y       = -9999;
    mouse.speed   = 0;
    mouse.vx      = 0;
    mouse.vy      = 0;
    mouse.gesture = 'none';
    pathHead = 0;
    pathFull = false;
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
