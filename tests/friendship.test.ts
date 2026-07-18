import { describe, it, expect } from 'vitest';
import { ISLANDERS, friendId, friendPairs } from '@/content/roster';

describe('Islander friendships (post-1.0, deterministic pairing)', () => {
  it('pairs neighbours two-by-two in roster order (reciprocal)', () => {
    const a = ISLANDERS[0]!.id;
    const b = ISLANDERS[1]!.id;
    expect(friendId(a)).toBe(b);
    expect(friendId(b)).toBe(a); // symmetric
    // the next pair is independent
    expect(friendId(ISLANDERS[2]!.id)).toBe(ISLANDERS[3]!.id);
  });

  it('is stable/deterministic and defined for every roster member', () => {
    for (const d of ISLANDERS) {
      const f = friendId(d.id);
      expect(f).toBeDefined();
      expect(friendId(f!)).toBe(d.id); // always reciprocal
    }
  });

  it('returns undefined for an unknown id', () => {
    expect(friendId('nobody')).toBeUndefined();
  });

  it('friendPairs only lists pairs where BOTH neighbours are present', () => {
    const a = ISLANDERS[0]!.id;
    const b = ISLANDERS[1]!.id;
    const c = ISLANDERS[2]!.id;
    // only the first neighbour present → no complete pair yet
    expect(friendPairs([a])).toHaveLength(0);
    // the pair completes once the friend moves in
    expect(friendPairs([a, b])).toEqual([{ a, b }]);
    // a lone third neighbour doesn't form a pair on its own
    expect(friendPairs([a, b, c])).toEqual([{ a, b }]);
  });

  it('lists multiple pairs as more neighbours arrive', () => {
    const present = ISLANDERS.slice(0, 4).map((d) => d.id);
    const pairs = friendPairs(present);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toEqual({ a: ISLANDERS[0]!.id, b: ISLANDERS[1]!.id });
    expect(pairs[1]).toEqual({ a: ISLANDERS[2]!.id, b: ISLANDERS[3]!.id });
  });
});
