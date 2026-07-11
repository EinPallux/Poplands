/**
 * Fish species (the fishing pond, post-1.0) as data — content-as-data per
 * CLAUDE.md. Each `id` is a STABLE save contract (persisted in the fishing
 * collection slice); never rename after shipping. `nameKey` routes the display
 * name through the string table (i18n-ready). Weighted `weight` drives the catch
 * roll; every reward is positive — even the boot pays a little (the no-fail
 * covenant, GDD §7.5). three.js-free (content layer).
 */
import type { StringKey } from '@/core/strings';

export type FishRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface FishDef {
  /** Stable persisted id (fishing collection slice). Never rename after shipping. */
  id: string;
  nameKey: StringKey;
  rarity: FishRarity;
  /** Relative weight in the catch roll (higher ⇒ more common). */
  weight: number;
  reward: { pops: number; stardust?: number; xp: number };
  /** Emoji shown in the catch popup + the journal (the game's UI is emoji-first). */
  icon: string;
}

const fish = (d: FishDef): FishDef => d;

/** The catchable roster. Commons dominate; legendaries are a rare treat. */
export const FISH: readonly FishDef[] = [
  fish({ id: 'fish.pebblefin', nameKey: 'fish.pebblefin', rarity: 'common', weight: 24, reward: { pops: 8, xp: 2 }, icon: '🐟' }),
  fish({ id: 'fish.sunperch', nameKey: 'fish.sunperch', rarity: 'common', weight: 22, reward: { pops: 10, xp: 2 }, icon: '🐠' }),
  fish({ id: 'fish.bubbleguppy', nameKey: 'fish.bubbleguppy', rarity: 'common', weight: 20, reward: { pops: 9, xp: 2 }, icon: '🐡' }),
  fish({ id: 'fish.oldboot', nameKey: 'fish.oldboot', rarity: 'common', weight: 10, reward: { pops: 4, xp: 1 }, icon: '🥾' }),
  fish({ id: 'fish.spottedkoi', nameKey: 'fish.spottedkoi', rarity: 'uncommon', weight: 12, reward: { pops: 20, xp: 5 }, icon: '🎏' }),
  fish({ id: 'fish.ribboneel', nameKey: 'fish.ribboneel', rarity: 'uncommon', weight: 9, reward: { pops: 22, xp: 5 }, icon: '🐍' }),
  fish({ id: 'fish.whiskerfish', nameKey: 'fish.whiskerfish', rarity: 'uncommon', weight: 8, reward: { pops: 18, xp: 5 }, icon: '🐋' }),
  fish({ id: 'fish.moonscale', nameKey: 'fish.moonscale', rarity: 'rare', weight: 5, reward: { pops: 40, stardust: 1, xp: 10 }, icon: '🌙' }),
  fish({ id: 'fish.prismtrout', nameKey: 'fish.prismtrout', rarity: 'rare', weight: 4, reward: { pops: 45, stardust: 1, xp: 10 }, icon: '🐬' }),
  fish({ id: 'fish.rainbowfin', nameKey: 'fish.rainbowfin', rarity: 'legendary', weight: 2, reward: { pops: 75, stardust: 2, xp: 20 }, icon: '🌈' }),
  fish({ id: 'fish.starsturgeon', nameKey: 'fish.starsturgeon', rarity: 'legendary', weight: 1, reward: { pops: 90, stardust: 3, xp: 25 }, icon: '⭐' }),
];

const byId = new Map(FISH.map((f) => [f.id, f]));

export function fishDef(id: string): FishDef | undefined {
  return byId.get(id);
}

export const TOTAL_FISH_WEIGHT = FISH.reduce((s, f) => s + f.weight, 0);

/**
 * Weighted pick from a uniform `r` ∈ [0,1). Pure so the sim injects its RNG and
 * unit tests pin exact outcomes (r=0 ⇒ first entry, r→1 ⇒ last).
 */
export function rollFish(r: number): FishDef {
  let acc = r * TOTAL_FISH_WEIGHT;
  for (const f of FISH) {
    acc -= f.weight;
    if (acc < 0) return f;
  }
  return FISH[FISH.length - 1]!; // r===1 guard (rng is [0,1), so effectively unreachable)
}

export const RARITY_ORDER: readonly FishRarity[] = ['common', 'uncommon', 'rare', 'legendary'];
