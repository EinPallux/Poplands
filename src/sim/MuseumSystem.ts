/**
 * Museum / Collections Hall (post-1.0): donate caught fish onto display. THREE.JS-FREE.
 *
 * Donating a species is one-time and grants a rarity-scaled reward via `museum:donated`
 * (credited by Economy, like fishing/gifts). Only species the player has actually caught
 * can be donated — it reads a caught-provider (the fishing collection), never the fish
 * themselves, so nothing is consumed or lost (no fail states). When every fish is on
 * display the Fish Hall completes once (`museum:completed`). Mutates the save slice.
 */
import { bus } from '@/core/events';
import type { StringKey } from '@/core/strings';
import type { SaveMuseum } from '@/core/save';
import { FISH, fishDef, type FishRarity } from '@/content/fish';

const DONATION_REWARD: Record<FishRarity, { pops: number; stardust?: number }> = {
  common: { pops: 25 },
  uncommon: { pops: 50, stardust: 1 },
  rare: { pops: 100, stardust: 2 },
  legendary: { pops: 200, stardust: 3 },
};

type DisplayState = 'display' | 'catchable' | 'locked';

export class MuseumSystem {
  private readonly donated: Set<string>;

  constructor(
    private readonly state: SaveMuseum,
    private readonly caughtSpecies: () => string[],
  ) {
    this.donated = new Set(state.donated);
  }

  canDonate(species: string): boolean {
    return !this.donated.has(species) && !!fishDef(species) && this.caughtSpecies().includes(species);
  }

  /** Put a caught species on display. Returns false (no-op) if it can't be donated. */
  donate(species: string): boolean {
    if (!this.canDonate(species)) return false;
    const def = fishDef(species)!;
    this.donated.add(species);
    this.state.donated = [...this.donated];
    const r = DONATION_REWARD[def.rarity];
    bus.emit('museum:donated', {
      species,
      nameKey: def.nameKey,
      icon: def.icon,
      rarity: def.rarity,
      rewards: { pops: r.pops, ...(r.stardust ? { stardust: r.stardust } : {}) },
    });
    if (this.donated.size === FISH.length) bus.emit('museum:completed', undefined);
    return true;
  }

  /** Read-only view for the panel: each fish's display state + progress counts. */
  view(): {
    fish: Array<{ id: string; nameKey: StringKey; icon: string; rarity: FishRarity; state: DisplayState }>;
    donatedCount: number;
    total: number;
  } {
    const caught = new Set(this.caughtSpecies());
    const fish = FISH.map((f) => ({
      id: f.id,
      nameKey: f.nameKey,
      icon: f.icon,
      rarity: f.rarity,
      state: (this.donated.has(f.id) ? 'display' : caught.has(f.id) ? 'catchable' : 'locked') as DisplayState,
    }));
    return { fish, donatedCount: this.donated.size, total: FISH.length };
  }

  snapshot(): SaveMuseum {
    return { donated: [...this.donated] };
  }
}
