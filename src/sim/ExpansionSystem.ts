/**
 * Chunk expansion (S7/S8): offers a Survey on EVERY free edge of the island,
 * charges both wallets on purchase, grows the lattice, and refreshes offers.
 * THREE.JS-FREE — the arrival set-piece + world rebuild are presentation's job,
 * reacting to `chunk:unlocked` / `island:grew` (F2 flow). A player can call a
 * chunk on any frontier they can afford (user 2026-07-12) — no seeded subset and
 * no re-roll; the biome each slot would become is still `themeFor`-seeded.
 */
import { bus } from '@/core/events';
import { chunkPrice, canExpand, type ChunkPrice } from '@/content/expansion';
import { themeFor } from '@/content/themes';
import type { ChunkTheme } from '@/core/grid';
import type { IslandModel } from '@/world/IslandModel';
import type { EconomySystem } from './EconomySystem';

export interface SurveySlot {
  cx: number;
  cz: number;
  pops: number;
  stardust: number;
  theme: ChunkTheme;
}

export class ExpansionSystem {
  private unsubs: Array<() => void> = [];

  constructor(
    private readonly island: IslandModel,
    private readonly economy: EconomySystem,
    private readonly seed: number,
  ) {}

  wire(): void {
    this.unsubs.push(bus.on('cmd:buyChunk', (e) => this.onBuy(e.cx, e.cz)));
    // re-theme a placed chunk's biome (post-1.0) — free, cosmetic, no-grind; the
    // world rebuild + persistence react to the domain event we emit here.
    this.unsubs.push(
      bus.on('cmd:reThemeChunk', (e) => {
        if (this.island.reTheme(e.cx, e.cz, e.theme)) {
          bus.emit('chunk:reThemed', { cx: e.cx, cz: e.cz, theme: e.theme });
        }
      }),
    );
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
  }

  /** Re-emit the current survey offers to the HUD (GameState.start()). */
  announce(): void {
    bus.emit('chunk:offered', { slots: this.surveys() });
  }

  /** EVERY buyable adjacent chunk slot (all four sides), all at the current price —
   *  a player can call a chunk on any frontier (user 2026-07-12). []=at the cap. */
  surveys(): SurveySlot[] {
    if (!canExpand(this.island.chunkCount)) return [];
    const price = chunkPrice(this.island.chunkCount);
    return this.island.expandableSlots().map((c) => ({
      cx: c.cx,
      cz: c.cz,
      pops: price.pops,
      stardust: price.stardust,
      theme: themeFor(this.seed, c.cx, c.cz),
    }));
  }

  private onBuy(cx: number, cz: number): void {
    if (!canExpand(this.island.chunkCount)) return; // soft cap → offers already empty
    if (!this.surveys().some((s) => s.cx === cx && s.cz === cz)) return; // not a live survey
    const price = chunkPrice(this.island.chunkCount);
    if (!this.economy.trySpend(price.pops, price.stardust)) {
      bus.emit('purchase:denied', { reason: this.economy.shortOf(price.pops) });
      return;
    }
    const theme = themeFor(this.seed, cx, cz);
    this.island.addChunk(cx, cz, theme);
    bus.emit('chunk:unlocked', { cx, cz, index: this.island.chunkCount, theme });
    bus.emit('island:grew', undefined);
    bus.emit('chunk:offered', { slots: this.surveys() }); // new frontier slots opened up
  }

  /** For debug/tests — the current price the next chunk would cost. */
  nextPrice(): ChunkPrice {
    return chunkPrice(this.island.chunkCount);
  }
}
