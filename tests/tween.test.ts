import { describe, it, expect } from 'vitest';
import { Tweens, easings } from '@/core/tween';
import { SpringValue, damp, dampAngle } from '@/core/spring';

describe('easings', () => {
  it('all start at 0 and end at 1', () => {
    for (const [name, ease] of Object.entries(easings)) {
      expect(ease(0), `${name}(0)`).toBeCloseTo(0, 5);
      expect(ease(1), `${name}(1)`).toBeCloseTo(1, 5);
    }
  });

  it('backOut overshoots past 1 mid-curve (the "pop")', () => {
    let max = 0;
    for (let t = 0; t <= 1; t += 0.01) max = Math.max(max, easings.backOut(t));
    expect(max).toBeGreaterThan(1.05);
  });

  it('popBounce overshoots ~1.16, dips back below 1, then settles (the "boing")', () => {
    let peak = 0;
    let peakT = 0;
    for (let t = 0; t <= 1; t += 0.005) {
      const v = easings.popBounce(t);
      if (v > peak) {
        peak = v;
        peakT = t;
      }
    }
    expect(peak).toBeGreaterThan(1.12);
    expect(peak).toBeLessThan(1.25); // bouncier than backOut, but still cozy
    // after the peak it must settle back through a sub-1 dip (the secondary bounce)
    let minAfterPeak = 2;
    for (let t = peakT; t <= 0.99; t += 0.005) {
      minAfterPeak = Math.min(minAfterPeak, easings.popBounce(t));
    }
    expect(minAfterPeak).toBeLessThan(1);
  });
});

describe('Tweens', () => {
  it('runs to completion and fires onComplete once', () => {
    const tw = new Tweens();
    let value = 0;
    let completions = 0;
    tw.start({
      duration: 1,
      ease: easings.linear,
      onUpdate: (t) => (value = t),
      onComplete: () => completions++,
    });
    tw.update(0.5);
    expect(value).toBeCloseTo(0.5);
    tw.update(0.6);
    expect(value).toBe(1);
    expect(completions).toBe(1);
    expect(tw.count).toBe(0);
    tw.update(0.1); // no-op after completion
    expect(completions).toBe(1);
  });

  it('honors delay and cancellation', () => {
    const tw = new Tweens();
    let value = -1;
    const handle = tw.start({ duration: 1, delay: 0.5, onUpdate: (t) => (value = t) });
    tw.update(0.4);
    expect(value).toBe(-1); // still delayed
    handle.cancel();
    tw.update(1);
    expect(value).toBe(-1); // canceled before ever updating
    expect(handle.done).toBe(true);
  });

  it('supports many concurrent tweens with swap-remove', () => {
    const tw = new Tweens();
    const done: number[] = [];
    for (let i = 0; i < 100; i++) {
      tw.start({ duration: (i + 1) / 100, onUpdate: () => {}, onComplete: () => done.push(i) });
    }
    for (let f = 0; f < 120; f++) tw.update(1 / 100);
    expect(done).toHaveLength(100);
    expect(tw.count).toBe(0);
  });
});

describe('springs & damping', () => {
  it('damp converges regardless of step size', () => {
    let a = 0;
    for (let i = 0; i < 200; i++) a = damp(a, 10, 8, 1 / 60);
    expect(a).toBeCloseTo(10, 3);
    let b = 0;
    for (let i = 0; i < 40; i++) b = damp(b, 10, 8, 1 / 10);
    expect(b).toBeCloseTo(10, 3);
  });

  it('dampAngle takes the short way around', () => {
    // 350° → 10°: should increase through 360°, not spin backward.
    let a = (350 * Math.PI) / 180;
    const target = (370 * Math.PI) / 180; // equivalent of 10°
    const before = a;
    a = dampAngle(a, (10 * Math.PI) / 180, 10, 1 / 60);
    expect(a).toBeGreaterThan(before);
    void target;
  });

  it('SpringValue settles on its target', () => {
    const s = new SpringValue(0, 170, 0.75);
    s.target = 5;
    for (let i = 0; i < 300; i++) s.update(1 / 60);
    expect(s.value).toBeCloseTo(5, 2);
    expect(s.isSettled(0.01)).toBe(true);
  });
});
