/**
 * Chunk-expansion economy (S7, CONTENT_PLAN §6.2) as pure data. THREE.JS-FREE.
 *
 * The starter island is 4 free chunks. Purchase index k = chunk# − 4 (first buy
 * is k=1). Price:
 *   Pops(k)     = round10( 250 · 1.32^(k−1) )      for k ≤ 8   (chunks 5–12)
 *               = round10( 250 · 1.32^7 · 1.13^(k−8) ) for k ≥ 9
 *   Stardust(k) = 2 + ⌊k/4⌋
 * Themed chunks (v0.6+) are +25% on both; v0.4 ships Meadow-only so themed=false.
 * Stardust is the intended binding constraint mid-game (income can't trivialize
 * expansion); the ✦ curve stays single-digit until the very end.
 */
export const STARTER_CHUNKS = 4;
export const CHUNK_SOFT_CAP = 36; // GDD §5.1 — invisible; offers simply stop here
export const REROLL_POPS = 10; // token fee to re-roll survey positions (never a timer)

const round10 = (n: number): number => Math.round(n / 10) * 10;

export interface ChunkPrice {
  pops: number;
  stardust: number;
}

/** Price of the NEXT chunk, given how many chunks are currently owned. */
export function chunkPrice(currentChunkCount: number, themed = false): ChunkPrice {
  const k = currentChunkCount - STARTER_CHUNKS + 1; // owned 4 → next buy is k=1
  const rampPops =
    k <= 8 ? 250 * Math.pow(1.32, k - 1) : 250 * Math.pow(1.32, 7) * Math.pow(1.13, k - 8);
  const mult = themed ? 1.25 : 1;
  return {
    pops: round10(rampPops * mult),
    stardust: Math.round((2 + Math.floor(k / 4)) * mult),
  };
}

/** True while the island can still grow (below the soft cap). */
export const canExpand = (currentChunkCount: number): boolean => currentChunkCount < CHUNK_SOFT_CAP;
