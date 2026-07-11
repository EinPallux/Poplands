/**
 * The single rAF loop (S1): clamped dt, visibility pause (0 CPU when hidden),
 * fps tracking for the quality probe & debug HUD. Fixed-step sim accumulator
 * arrives with the economy in v0.3.
 */
import { bus } from '@/core/events';

const MAX_DT = 0.05; // clamp: tab hiccups must not teleport animations

export class GameLoop {
  private updates: Array<(dt: number) => void> = [];
  private rafId = 0;
  private running = false;
  private lastTime = 0;
  private hiddenAt = 0;
  private fpsEma = 60;
  private minFrameMs = 0; // 0 = uncapped; else the frame-cap interval (S23)

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
        this.hiddenAt = performance.now();
        bus.emit('app:pause', undefined);
      } else {
        bus.emit('app:resume', { elapsedMs: performance.now() - this.hiddenAt });
        this.resume();
      }
    });
  }

  add(update: (dt: number) => void): void {
    this.updates.push(update);
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  get fps(): number {
    return this.fpsEma;
  }

  /** Cap the frame rate (S23 accessibility/perf). 0 = uncapped. */
  setFpsCap(fps: number): void {
    this.minFrameMs = fps > 0 ? (1000 / fps) * 0.9 : 0;
  }

  private pause(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private resume(): void {
    if (this.running) return;
    this.start();
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick); // keep the loop alive even if we skip
    const elapsed = now - this.lastTime;
    if (this.minFrameMs > 0 && elapsed < this.minFrameMs) return; // frame-cap: drop this frame
    this.lastTime = now;
    const rawDt = elapsed / 1000;
    const dt = Math.min(rawDt, MAX_DT);
    if (rawDt > 0) this.fpsEma += (1 / Math.max(rawDt, 1e-4) - this.fpsEma) * 0.05;
    for (const update of this.updates) update(dt);
  };
}
