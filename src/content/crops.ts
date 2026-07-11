/**
 * Crops (the Garden Patch, post-1.0) as data — content-as-data per CLAUDE.md.
 * Plant a seed in a Garden Patch, wait for it to grow through its stages, then
 * harvest for a positive reward (Pops + XP, a Stardust bonus on the rare golden
 * crop). Nothing ever wilts — a ripe crop waits patiently forever (the no-FOMO
 * covenant, GDD §7.5). Rarer/slower crops unlock with level. three.js-free.
 *
 * `id` is a STABLE save contract (persisted in a plot's planting); never rename.
 * `growMs` is real milliseconds to ripen; growth is time-based off the plant
 * timestamp, so it continues while you're away (offline-safe, like income).
 */
import type { StringKey } from '@/core/strings';

export interface CropDef {
  /** Stable persisted id (garden plot slice). Never rename after shipping. */
  id: string;
  nameKey: StringKey;
  icon: string; // ripe-crop emoji (also the seed-picker glyph)
  growMs: number; // real time to ripen
  reward: { pops: number; stardust?: number; xp: number };
  minLevel: number; // unlock gate — rarer crops appear as you level up
}

const crop = (d: CropDef): CropDef => d;

/** Sorted by unlock level then grow time, so the seed picker reads as a progression. */
export const CROPS: readonly CropDef[] = [
  crop({ id: 'crop.carrot', nameKey: 'crop.carrot', icon: '🥕', growMs: 45_000, reward: { pops: 15, xp: 3 }, minLevel: 1 }),
  crop({ id: 'crop.tomato', nameKey: 'crop.tomato', icon: '🍅', growMs: 60_000, reward: { pops: 22, xp: 4 }, minLevel: 1 }),
  crop({ id: 'crop.strawberry', nameKey: 'crop.strawberry', icon: '🍓', growMs: 75_000, reward: { pops: 30, xp: 5 }, minLevel: 2 }),
  crop({ id: 'crop.corn', nameKey: 'crop.corn', icon: '🌽', growMs: 90_000, reward: { pops: 38, xp: 6 }, minLevel: 2 }),
  crop({ id: 'crop.chili', nameKey: 'crop.chili', icon: '🌶️', growMs: 105_000, reward: { pops: 46, xp: 7 }, minLevel: 3 }),
  crop({ id: 'crop.sunflower', nameKey: 'crop.sunflower', icon: '🌻', growMs: 120_000, reward: { pops: 55, xp: 8 }, minLevel: 3 }),
  crop({ id: 'crop.grapes', nameKey: 'crop.grapes', icon: '🍇', growMs: 140_000, reward: { pops: 66, xp: 10 }, minLevel: 4 }),
  crop({ id: 'crop.pumpkin', nameKey: 'crop.pumpkin', icon: '🎃', growMs: 160_000, reward: { pops: 78, xp: 12 }, minLevel: 5 }),
  crop({ id: 'crop.watermelon', nameKey: 'crop.watermelon', icon: '🍉', growMs: 185_000, reward: { pops: 96, xp: 14 }, minLevel: 6 }),
  crop({ id: 'crop.golden', nameKey: 'crop.golden', icon: '🌟', growMs: 300_000, reward: { pops: 220, stardust: 2, xp: 26 }, minLevel: 9 }),
];

const byId = new Map(CROPS.map((c) => [c.id, c]));

export function cropDef(id: string): CropDef | undefined {
  return byId.get(id);
}
