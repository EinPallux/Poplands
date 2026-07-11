/**
 * Frame-rate-independent smoothing & springs — the camera's (and later the juice
 * system's) foundation (SYSTEMS S6/S11).
 */
import { angleDelta } from './math';

/**
 * Exponential damping toward a target ("critically damped" feel, no overshoot).
 * `lambda` ≈ responsiveness: higher = snappier. Stable for any dt.
 */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

/** Like damp, but takes the shortest path around the circle (for azimuth angles). */
export const dampAngle = (current: number, target: number, lambda: number, dt: number): number =>
  current + angleDelta(current, target) * (1 - Math.exp(-lambda * dt));

/**
 * A springy scalar with momentum (can overshoot — used for bouncy juice, not the camera).
 * Semi-implicit Euler; `stiffness` (ω²-ish) and `damping` ζ-style ratio.
 */
export class SpringValue {
  value: number;
  target: number;
  velocity = 0;

  constructor(
    initial = 0,
    public stiffness = 170,
    public dampingRatio = 0.75,
  ) {
    this.value = initial;
    this.target = initial;
  }

  /** Step the spring. Subdivides big dt for stability. */
  update(dt: number): number {
    let remaining = dt;
    const maxStep = 1 / 120;
    while (remaining > 0) {
      const h = remaining > maxStep ? maxStep : remaining;
      const omega = Math.sqrt(this.stiffness);
      const c = 2 * this.dampingRatio * omega;
      const accel = (this.target - this.value) * this.stiffness - this.velocity * c;
      this.velocity += accel * h;
      this.value += this.velocity * h;
      remaining -= h;
    }
    return this.value;
  }

  /** True once the spring has visually settled. */
  isSettled(epsilon = 1e-3): boolean {
    return Math.abs(this.value - this.target) < epsilon && Math.abs(this.velocity) < epsilon * 10;
  }

  snapTo(v: number): void {
    this.value = v;
    this.target = v;
    this.velocity = 0;
  }
}
