import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '@/core/events';
import { signal, computed, effect } from '@/core/signals';
import { t, stringTable } from '@/core/strings';
import { mulberry32, emod, fdiv, clamp, hash2 } from '@/core/math';

describe('EventBus', () => {
  interface M extends Record<string, unknown> {
    ping: { n: number };
    empty: void;
  }

  it('delivers typed payloads and unsubscribes', () => {
    const bus = new EventBus<M>();
    const seen: number[] = [];
    const off = bus.on('ping', (p) => seen.push(p.n));
    bus.emit('ping', { n: 1 });
    off();
    bus.emit('ping', { n: 2 });
    expect(seen).toEqual([1]);
    expect(bus.subscriptionCount).toBe(0);
  });

  it('once fires exactly once', () => {
    const bus = new EventBus<M>();
    const fn = vi.fn();
    bus.once('empty', fn);
    bus.emit('empty', undefined);
    bus.emit('empty', undefined);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('signals', () => {
  it('effect re-runs on change; computed derives', () => {
    const a = signal(2);
    const doubled = computed(() => a.get() * 2);
    const log: number[] = [];
    const dispose = effect(() => log.push(doubled.get()));
    a.set(5);
    expect(doubled.get()).toBe(10);
    expect(log).toEqual([4, 10]);
    dispose();
    a.set(7);
    expect(log).toEqual([4, 10]);
  });

  it('set with identical value does not notify', () => {
    const a = signal(1);
    const fn = vi.fn(() => a.get());
    effect(fn);
    a.set(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('strings (i18n)', () => {
  it('returns English strings for every key', () => {
    for (const key of Object.keys(stringTable) as Array<keyof typeof stringTable>) {
      expect(t(key)).toBe(stringTable[key]);
      expect(t(key).length).toBeGreaterThan(0);
    }
  });
});

describe('math', () => {
  it('emod/fdiv handle negatives', () => {
    expect(emod(-1, 8)).toBe(7);
    expect(fdiv(-1, 8)).toBe(-1);
    expect(clamp(5, 0, 3)).toBe(3);
  });

  it('mulberry32 is deterministic and uniform-ish', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    const r = mulberry32(7);
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += r();
    expect(sum / 1000).toBeGreaterThan(0.45);
    expect(sum / 1000).toBeLessThan(0.55);
  });

  it('hash2 differs across neighbors and is stable', () => {
    expect(hash2(1, 2)).toBe(hash2(1, 2));
    expect(hash2(1, 2)).not.toBe(hash2(2, 1));
  });
});
