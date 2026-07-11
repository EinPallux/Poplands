/**
 * Chunk expansion (S7/S8): offers up to 3 Surveys on the island's free edges,
 * charges both wallets on purchase, grows the lattice, and refreshes offers.
 * THREE.JS-FREE — the arrival set-piece + world rebuild are presentation's job,
 * reacting to `chunk:unlocked` / `island:grew` (F2 flow). Survey selection is a
 * deterministic seeded pick over the (sorted) candidates, re-rollable for a token
 * Pop fee (never a timer — no-grind covenant).
 */
import { bus } from '@/core/events';
import { mulberry32 } from '@/core/math';
import { chunkPrice, canExpand, REROLL_POPS, type ChunkPrice } from '@/content/expansion';
import { themeFor } from '@/content/themes';
import type { ChunkCoord, ChunkTheme } from '@/core/grid';
import type { IslandModel } from '@/world/IslandModel';
import type { EconomySystem } from './EconomySystem';

export interface SurveySlot {
  cx: number;
  cz: number;
  pops: number;
  stardust: number;
  theme: ChunkTheme;
}

const MAX_SURVEYS = 3;

export class ExpansionSystem {
  private unsubs: Array<() => void> = [];
  private rerollNonce = 0;

  constructor(
    private readonly island: IslandModel,
    private readonly economy: EconomySystem,
    private readonly seed: number,
  ) {}

  wire(): void {
    this.unsubs.push(
      bus.on('cmd:buyChunk', (e) => this.onBuy(e.cx, e.cz)),
      bus.on('cmd:rerollSurveys', () => this.onReroll()),
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

  /** Up to 3 buyable adjacent chunk slots, all at the current price. []=at the cap. */
  surveys(): SurveySlot[] {
    if (!canExpand(this.island.chunkCount)) return [];
    const candidates = this.island.expandableSlots();
    if (candidates.length === 0) return [];
    const price = chunkPrice(this.island.chunkCount);
    return this.pick(candidates, MAX_SURVEYS).map((c) => ({
      cx: c.cx,
      cz: c.cz,
      pops: price.pops,
      stardust: price.stardust,
      theme: themeFor(this.seed, c.cx, c.cz),
    }));
  }

  /** Deterministic subset (seeded Fisher–Yates) — stable per (seed, size, nonce). */
  private pick(items: readonly ChunkCoord[], k: number): ChunkCoord[] {
    if (items.length <= k) return [...items];
    const rng = mulberry32(
      (this.seed ^ (this.island.chunkCount * 2654435761) ^ (this.rerollNonce * 40503)) >>> 0,
    );
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr.slice(0, k);
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
    this.rerollNonce++; // offers refresh after a purchase (F2)
    bus.emit('chunk:unlocked', { cx, cz, index: this.island.chunkCount, theme });
    bus.emit('island:grew', undefined);
    bus.emit('chunk:offered', { slots: this.surveys() });
  }

  private onReroll(): void {
    if (this.island.expandableSlots().length <= MAX_SURVEYS) return; // nothing new to show
    if (!this.economy.trySpend(REROLL_POPS, 0)) {
      bus.emit('purchase:denied', { reason: 'pops' });
      return;
    }
    this.rerollNonce++;
    bus.emit('chunk:offered', { slots: this.surveys() });
  }

  /** For debug/tests — the current price the next chunk would cost. */
  nextPrice(): ChunkPrice {
    return chunkPrice(this.island.chunkCount);
  }
}
