import { describe, it, expect } from 'vitest';
import { LivelinessSystem } from '@/sim/LivelinessSystem';

describe('LivelinessSystem (S13)', () => {
  it('pays a capped, time-gated dividend and nothing when the island is empty', () => {
    let credited = 0;
    let pop = 0;
    const sys = new LivelinessSystem({ credit: (p) => (credited += p) }, () => pop);

    sys.update(9); // before the 10 s interval
    expect(credited).toBe(0);
    sys.update(2); // interval passed, but nobody lives here yet
    expect(credited).toBe(0);

    pop = 3;
    sys.update(10);
    expect(credited).toBe(6); // 3 souls × 2 Pops

    pop = 100;
    sys.update(10);
    expect(credited).toBe(6 + 36); // capped at 18 souls × 2
  });

  it('does not pay between intervals (not farmable per-frame)', () => {
    let credited = 0;
    const sys = new LivelinessSystem({ credit: (p) => (credited += p) }, () => 5);
    for (let i = 0; i < 100; i++) sys.update(1 / 60); // ~1.7 s of frames
    expect(credited).toBe(0);
  });
});
