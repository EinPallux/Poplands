/**
 * Minimal tween engine — v0.1 foundation of the Juice system (S11).
 * The full preset library (pop-in, coin arcs, chunk arrival) builds on this in v0.2.
 *
 * Design: one shared Tweens manager stepped by the game loop; handles are cancelable;
 * completed tweens are removed via swap-remove (no per-frame allocation).
 */

export type Ease = (t: number) => number;

export const easings = {
  linear: ((t) => t) as Ease,
  quadOut: ((t) => 1 - (1 - t) * (1 - t)) as Ease,
  cubicOut: ((t) => 1 - Math.pow(1 - t, 3)) as Ease,
  cubicInOut: ((t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)) as Ease,
  /** Signature "pop" arrival: overshoots to ~1.1 then settles (ART §7.1). */
  backOut: ((t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }) as Ease,
  /** Departure: pulls back before leaving. */
  backIn: ((t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  }) as Ease,
  sineInOut: ((t) => -(Math.cos(Math.PI * t) - 1) / 2) as Ease,
} as const;

export interface TweenOptions {
  /** Seconds. */
  duration: number;
  /** Seconds before starting. */
  delay?: number;
  ease?: Ease;
  /** Receives eased t in [0,1]. Drive any target — three.js props, DOM styles, audio params. */
  onUpdate: (t: number) => void;
  onComplete?: () => void;
}

export interface TweenHandle {
  cancel(): void;
  readonly done: boolean;
}

interface ActiveTween extends TweenOptions {
  elapsed: number;
  delayLeft: number;
  easeFn: Ease;
  canceled: boolean;
  finished: boolean;
}

export class Tweens {
  private active: ActiveTween[] = [];

  get count(): number {
    return this.active.length;
  }

  start(opts: TweenOptions): TweenHandle {
    const tw: ActiveTween = {
      ...opts,
      elapsed: 0,
      delayLeft: opts.delay ?? 0,
      easeFn: opts.ease ?? easings.cubicOut,
      canceled: false,
      finished: false,
    };
    this.active.push(tw);
    return {
      cancel: () => {
        tw.canceled = true;
      },
      get done() {
        return tw.finished || tw.canceled;
      },
    };
  }

  update(dt: number): void {
    const list = this.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const tw = list[i];
      if (tw === undefined) continue;
      if (tw.canceled) {
        this.removeAt(i);
        continue;
      }
      if (tw.delayLeft > 0) {
        tw.delayLeft -= dt;
        if (tw.delayLeft > 0) continue;
      }
      tw.elapsed += dt;
      const t = tw.duration <= 0 ? 1 : Math.min(tw.elapsed / tw.duration, 1);
      tw.onUpdate(tw.easeFn(t));
      if (t >= 1) {
        tw.finished = true;
        this.removeAt(i);
        tw.onComplete?.();
      }
    }
  }

  cancelAll(): void {
    for (const tw of this.active) tw.canceled = true;
    this.active.length = 0;
  }

  private removeAt(i: number): void {
    const list = this.active;
    const last = list.length - 1;
    if (i !== last) {
      const moved = list[last];
      if (moved !== undefined) list[i] = moved;
    }
    list.pop();
  }
}

/** The app-wide tween manager, stepped once per frame by the game loop (S1). */
export const tweens = new Tweens();
