/** Small math helpers shared across all layers. Keep three.js out of here (TECH §2). */

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Euclidean modulo — always returns a value in [0, m). */
export const emod = (v: number, m: number): number => ((v % m) + m) % m;

/** Floor division that stays correct for negative numerators. */
export const fdiv = (v: number, d: number): number => Math.floor(v / d);

export const TAU = Math.PI * 2;

/** Shortest signed angular difference a→b, in (-π, π]. */
export const angleDelta = (a: number, b: number): number => {
  const d = emod(b - a + Math.PI, TAU) - Math.PI;
  return d < -Math.PI ? d + TAU : d;
};

/**
 * Deterministic RNG (mulberry32). Content randomness (secrets, layouts) must use
 * this with a save-derived seed so islands are reproducible (TECH §3).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash for (x, z) pairs → 32-bit uint. Handy for per-cell deterministic jitter. */
export function hash2(x: number, z: number): number {
  let h = (x | 0) * 374761393 + (z | 0) * 668265263;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
