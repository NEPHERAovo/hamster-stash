export const SPRING_OUT_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const SHEET_SPRING_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

export function rubberBand(distance: number, dimension: number, factor = 0.55): number {
  if (distance === 0 || dimension <= 0) return 0;
  const abs = Math.abs(distance);
  const damped = (abs * dimension * factor) / (dimension + abs * factor);
  return distance < 0 ? -damped : damped;
}

interface VelocitySample {
  pos: number;
  time: number;
}

export class VelocityTracker {
  private samples: VelocitySample[] = [];
  private readonly windowMs: number;

  constructor(windowMs = 100) {
    this.windowMs = windowMs;
  }

  reset(pos: number, time = performance.now()): void {
    this.samples = [{ pos, time }];
  }

  push(pos: number, time = performance.now()): void {
    const cutoff = time - this.windowMs;
    while (this.samples.length > 0 && this.samples[0].time < cutoff) {
      this.samples.shift();
    }
    this.samples.push({ pos, time });
  }

  getVelocity(now = performance.now()): number {
    if (this.samples.length < 2) return 0;
    const latest = this.samples[this.samples.length - 1];
    if (now - latest.time > 90) return 0;

    const earliest = this.samples[0];
    const dt = latest.time - earliest.time;
    if (dt <= 0) return 0;
    return (latest.pos - earliest.pos) / dt;
  }
}

export function computeSettleDuration(
  remainingPx: number,
  velocityPxPerMs: number,
  minMs = 180,
  maxMs = 340
): number {
  const distanceRatio = Math.min(1, Math.abs(remainingPx) / 360);
  const baseDuration = minMs + distanceRatio * (maxMs - minMs);
  const speed = Math.abs(velocityPxPerMs);
  const velocityFactor = speed > 0.2 ? Math.max(0.55, 1 - (speed - 0.2) * 0.28) : 1;
  return Math.round(Math.max(minMs, Math.min(maxMs, baseDuration * velocityFactor)));
}

export function shouldDismissGesture(
  distancePx: number,
  velocityPxPerMs: number,
  distanceThreshold: number,
  velocityThreshold = 0.45
): boolean {
  if (velocityPxPerMs < -0.3) return false;
  if (velocityPxPerMs >= velocityThreshold && distancePx > 24) return true;
  return distancePx > distanceThreshold;
}

export class GestureSmoother {
  private current: number;
  private target: number;
  private rafId: number | null = null;
  private readonly onUpdate: (pos: number) => void;
  private readonly omega: number;

  constructor(onUpdate: (pos: number) => void, initialPos = 0, omega = 26) {
    this.onUpdate = onUpdate;
    this.current = initialPos;
    this.target = initialPos;
    this.omega = omega;
  }

  reset(val = 0): void {
    this.current = val;
    this.target = val;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setTarget(target: number): void {
    this.target = target;
    if (this.rafId === null) {
      let lastTime = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.064, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        const factor = 1 - Math.exp(-this.omega * dt);
        this.current += (this.target - this.current) * factor;

        this.onUpdate(this.current);

        if (Math.abs(this.target - this.current) > 0.2) {
          this.rafId = requestAnimationFrame(tick);
        } else {
          this.current = this.target;
          this.onUpdate(this.current);
          this.rafId = null;
        }
      };
      this.rafId = requestAnimationFrame(tick);
    }
  }

  getCurrent(): number {
    return this.current;
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
