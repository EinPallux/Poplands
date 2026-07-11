/**
 * Progression curve, rewards, and tier gating (S14) — pure functions, no bus,
 * no three.js. `xpToNext`/`MAX_LEVEL` live in playerStore (the derived progress
 * signal needs them); this module holds the level-advance logic + tables.
 */
import { xpToNext, MAX_LEVEL } from '@/core/playerStore';
import { MAX_TIER, itemsInTier } from '@/content/catalog';

export { MAX_LEVEL };

/** XP granted for placing an item of the given cost (min 1). */
export const placementXp = (cost: number): number => Math.max(1, Math.round(cost / 10));

/** Level-up rewards (Pops always, Stardust from L5). Cozy, generous, tunable. */
export function levelReward(level: number): { pops: number; stardust: number } {
  const pops = Math.round((30 * level) / 10) * 10;
  const stardust = level < 5 ? 0 : level % 5 === 0 ? 3 : 1;
  return { pops, stardust };
}

/** Tier N unlocks at Level N (identity mapping; extends to all catalog tiers). */
export const tierUnlockLevel = (tier: number): number => tier;

/** The tier a level-up to `level` unlocks, or null if that level gates no tier. */
export function tierUnlockedAt(level: number): number | null {
  return level >= 2 && level <= MAX_TIER ? level : null;
}

export interface XpResult {
  level: number;
  xp: number;
  /** Levels crossed this grant, ascending (empty if none). */
  leveled: number[];
}

/**
 * Apply an XP grant, advancing through as many levels as it funds. Pure.
 * At MAX_LEVEL excess XP is discarded (no penalty, cozy). xp is progress INTO
 * the current level.
 */
export function applyXp(state: { level: number; xp: number }, amount: number): XpResult {
  if (state.level >= MAX_LEVEL) return { level: MAX_LEVEL, xp: 0, leveled: [] };
  let level = state.level;
  let xp = state.xp + Math.max(0, amount);
  const leveled: number[] = [];
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    leveled.push(level);
  }
  if (level >= MAX_LEVEL) xp = 0;
  return { level, xp, leveled };
}

/** Item ids unlocked by reaching `level` (for the "New in Catalog" reveal). */
export function itemsUnlockedAt(level: number): string[] {
  const tier = tierUnlockedAt(level);
  return tier === null ? [] : itemsInTier(tier).map((d) => d.id);
}
