import { describe, it, expect } from 'vitest';
import { computeRating, computeHappiness, type RatingSnapshot } from '@/content/rating';

const EMPTY: RatingSnapshot = {
  chunks: 4, nature: 0, homes: 0, neighbours: 0, decor: 0, income: 0, pals: 0, distinctTypes: 0, crops: 0,
};

describe('Island Charm rating (post-1.0)', () => {
  it('a brand-new island still earns a friendly half-star (no-grind, never 0)', () => {
    const r = computeRating(EMPTY);
    expect(r.stars).toBe(0.5); // floored at a friendly minimum
    expect(r.overall).toBeGreaterThanOrEqual(0); // room axis gives a little base
    expect(r.verdictKey).toBe('rating.verdict.start');
  });

  it('a rich, varied island scores near the top with the masterpiece verdict', () => {
    const lush: RatingSnapshot = {
      chunks: 36, nature: 80, homes: 12, neighbours: 12, decor: 60, income: 20, pals: 12, distinctTypes: 40, crops: 6,
    };
    const r = computeRating(lush);
    expect(r.stars).toBeGreaterThanOrEqual(4.5);
    expect(r.stars).toBeLessThanOrEqual(5);
    expect(r.verdictKey).toBe('rating.verdict.masterpiece');
  });

  it('is monotonic — adding something never lowers the score', () => {
    const base = computeRating(EMPTY);
    const more = computeRating({ ...EMPTY, nature: 5 });
    expect(more.overall).toBeGreaterThan(base.overall);
    // every axis fraction is in [0,1)
    for (const c of more.categories) {
      expect(c.fraction).toBeGreaterThanOrEqual(0);
      expect(c.fraction).toBeLessThan(1);
    }
  });

  it('tips point at the least-filled axes first (the "what next?" cure)', () => {
    // lots of greenery, nothing else → greenery should NOT be a top tip
    const r = computeRating({ ...EMPTY, nature: 40 });
    const tipIds = r.tips.map((t) => t.id);
    expect(tipIds).not.toContain('greenery');
    expect(tipIds.length).toBeGreaterThan(0);
    expect(tipIds.length).toBeLessThanOrEqual(3);
    // community (empty) is a natural low axis → suggested
    expect(tipIds).toContain('community');
  });

  it('a maxed island shows the single "nothing to add" tip', () => {
    const lush: RatingSnapshot = {
      chunks: 36, nature: 200, homes: 40, neighbours: 12, decor: 200, income: 60, pals: 12, distinctTypes: 60, crops: 12,
    };
    const r = computeRating(lush);
    expect(r.tips).toHaveLength(1);
    expect(r.tips[0]!.tipKey).toBe('rating.tip.perfect');
  });

  it('always returns all six charm axes for the breakdown UI', () => {
    const r = computeRating(EMPTY);
    expect(r.categories.map((c) => c.id)).toEqual([
      'greenery', 'community', 'charm', 'critters', 'bustle', 'room',
    ]);
  });
});

describe('Island happiness (post-1.0)', () => {
  it('is always positive & never sad — even a bare island is "settling in"', () => {
    const h = computeHappiness(EMPTY);
    expect(h.score).toBeGreaterThanOrEqual(0);
    expect(h.moodKey).toBe('mood.content'); // the lowest mood, still cosy
    expect(h.emoji).toBeTruthy();
  });

  it('rises as amenities-per-neighbour grow, and tops out delighted', () => {
    const few: RatingSnapshot = { ...EMPTY, neighbours: 4, nature: 4 };
    const lots: RatingSnapshot = { ...EMPTY, neighbours: 4, nature: 60, decor: 30, homes: 8, pals: 6 };
    expect(computeHappiness(lots).score).toBeGreaterThan(computeHappiness(few).score);
    expect(computeHappiness(lots).moodKey).toBe('mood.delighted'); // a lavish, low-density island
  });

  it('more neighbours with the same amenities are a little less content (per-capita)', () => {
    const cosy: RatingSnapshot = { ...EMPTY, neighbours: 2, nature: 12, decor: 6 };
    const crowded: RatingSnapshot = { ...EMPTY, neighbours: 12, nature: 12, decor: 6 };
    expect(computeHappiness(crowded).score).toBeLessThan(computeHappiness(cosy).score);
  });

  it('is exposed on the rating result and nudges the overall score', () => {
    const r = computeRating({ ...EMPTY, neighbours: 4, nature: 20, decor: 12, homes: 4 });
    expect(r.happiness).toBeDefined();
    expect(r.happiness.score).toBeGreaterThan(0);
    // the happiness nudge keeps overall a blend, never above 1
    expect(r.overall).toBeLessThanOrEqual(1);
  });
});
