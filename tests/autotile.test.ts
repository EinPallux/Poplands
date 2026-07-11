import { describe, it, expect } from 'vitest';
import { resolveTileShape, DIRS } from '@/core/autotile';

const bit = (d: 'N' | 'E' | 'S' | 'W') => DIRS.find((x) => x.dir === d)!.bit;

describe('resolveTileShape (S10 auto-tiling)', () => {
  it('maps all 16 neighbour masks to the right connectivity shape', () => {
    expect(resolveTileShape(0).shape).toBe('isolated');
    // one neighbour → end (any single direction)
    for (const d of ['N', 'E', 'S', 'W'] as const) expect(resolveTileShape(bit(d)).shape).toBe('end');
    // opposite pair → straight
    expect(resolveTileShape(bit('N') | bit('S')).shape).toBe('straight');
    expect(resolveTileShape(bit('E') | bit('W')).shape).toBe('straight');
    // adjacent pair → corner
    for (const [a, b] of [
      ['N', 'E'],
      ['E', 'S'],
      ['S', 'W'],
      ['W', 'N'],
    ] as const)
      expect(resolveTileShape(bit(a) | bit(b)).shape).toBe('corner');
    // three neighbours → tee
    expect(resolveTileShape(bit('N') | bit('E') | bit('W')).shape).toBe('tee');
    expect(resolveTileShape(bit('N') | bit('E') | bit('S')).shape).toBe('tee');
    // all four → cross
    expect(resolveTileShape(15).shape).toBe('cross');
  });

  it('covers every mask with a defined shape+rot (bijective, no gaps)', () => {
    const valid = new Set(['isolated', 'end', 'straight', 'corner', 'tee', 'cross']);
    for (let m = 0; m < 16; m++) {
      const r = resolveTileShape(m);
      expect(valid.has(r.shape)).toBe(true);
      expect([0, 1, 2, 3]).toContain(r.rot);
    }
  });
});
