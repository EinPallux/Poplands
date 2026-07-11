import { describe, it, expect } from 'vitest';
import { xpToNext, MAX_LEVEL } from '@/core/playerStore';
import { levelReward, tierUnlockLevel, placementXp } from '@/sim/progression';
import { chunkPrice, STARTER_CHUNKS } from '@/content/expansion';
import { CATALOG, MAX_TIER, itemsInTier } from '@/content/catalog';
import { MILESTONES } from '@/content/quests';

/**
 * Full-arc balance guardrails (S14, v0.7). Locks the shape validated by the
 * `scripts/balance-v07.mts` model so future content/tuning can't silently break
 * the no-grind covenant. Numbers here assert *invariants*, not exact values.
 */
describe('full-arc balance (L1→L20)', () => {
  it('the XP curve is smooth past the early ramp (no cliff)', () => {
    let prev = 0;
    let worst = 1;
    for (let L = 1; L < MAX_LEVEL; L++) {
      const x = xpToNext(L);
      if (prev >= 300) worst = Math.max(worst, x / prev);
      prev = x;
    }
    expect(worst).toBeLessThanOrEqual(1.6);
  });

  it('every tier is reachable — the cheapest item is never an impossible wall', () => {
    let cumPops = 150;
    const byLevel: Record<number, number> = { 1: 150 };
    for (let L = 2; L <= MAX_LEVEL; L++) {
      cumPops += levelReward(L).pops;
      byLevel[L] = cumPops;
    }
    for (let tier = 1; tier <= MAX_TIER; tier++) {
      const items = itemsInTier(tier);
      if (!items.length) continue;
      const cheapest = Math.min(...items.map((d) => d.cost));
      const floor = byLevel[Math.min(tierUnlockLevel(tier), MAX_LEVEL)] ?? 150;
      // income is the real Pops faucet; the level-reward floor alone × a generous
      // buffer must still clear the cheapest item (catches an absurd mispriced tier).
      expect(cheapest, `tier ${tier} cheapest ${cheapest}`).toBeLessThanOrEqual(floor * 8 + 500);
    }
  });

  it('the Wonder capstone is affordable from guaranteed ✦ faucets alone', () => {
    let sdLevels = 0;
    for (let L = 2; L <= MAX_LEVEL; L++) sdLevels += levelReward(L).stardust;
    let sdMilestones = 0;
    for (const m of MILESTONES) for (const t of m.tiers) sdMilestones += t.reward.stardust ?? 0;
    const guaranteed = sdLevels + sdMilestones;
    const wonderSd = CATALOG.find((d) => d.id === 'decor.the-wonder')!.costStardust ?? 0;
    expect(guaranteed).toBeGreaterThanOrEqual(wonderSd);
    // …with room left to at least double the starter island (≥4 chunk buys after the Wonder)
    let sd = wonderSd;
    let buys = 0;
    for (let owned = STARTER_CHUNKS; owned < 36; owned++) {
      sd += chunkPrice(owned).stardust;
      if (sd <= guaranteed) buys++;
      else break;
    }
    expect(buys).toBeGreaterThanOrEqual(4);
  });

  it('placement XP scales with cost, so a developed island funds L20', () => {
    let total = 0;
    for (let L = 1; L < MAX_LEVEL; L++) total += xpToNext(L);
    const basket = CATALOG.reduce((s, d) => s + placementXp(d.cost), 0) * 2; // 2× the catalog
    expect(basket).toBeGreaterThanOrEqual(total);
  });
});
