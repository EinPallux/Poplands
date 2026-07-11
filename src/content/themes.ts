/**
 * Chunk themes (S7, v0.6): the biome palettes that give grown districts their own
 * character — a sandy Sandbar, a moody Spooky hollow, a bright Snowcap. Data only;
 * the renderers (GroundBuilder/SlabBuilder) read these to colour a chunk's lawn and
 * grass lip. `themeFor` is a deterministic per-(seed,chunk) roll so the world is
 * reproducible and offers can preview what a Survey will bring up.
 */
import { mulberry32, hash2 } from '@/core/math';
import type { ChunkTheme } from '@/core/grid';

export interface ThemePalette {
  grassTop: number;
  grassLight: number;
  grassSide: number;
}

export const THEMES: Record<ChunkTheme, ThemePalette> = {
  meadow: { grassTop: 0x7fd63f, grassLight: 0x99e558, grassSide: 0x67c433 },
  sandbar: { grassTop: 0xe6d39a, grassLight: 0xf2e6bc, grassSide: 0xd2b877 },
  spooky: { grassTop: 0x4c4568, grassLight: 0x625a82, grassSide: 0x3a3450 },
  snowcap: { grassTop: 0xe9f3ff, grassLight: 0xffffff, grassSide: 0xccdcef },
};

/** Emoji hint shown on a Survey chip so you know what biome you're calling up. */
export const THEME_EMOJI: Record<ChunkTheme, string> = {
  meadow: '🌱',
  sandbar: '🏖️',
  spooky: '🌙',
  snowcap: '❄️',
};

/** Deterministic biome for a chunk. Meadow stays the common home turf; the exotic
 *  themes sprinkle in as you expand outward (never the 2×2 starter — those are
 *  seeded meadow in the save and never re-rolled). */
export function themeFor(seed: number, cx: number, cz: number): ChunkTheme {
  const rng = mulberry32((seed ^ hash2(cx, cz)) >>> 0);
  const r = rng();
  if (r < 0.58) return 'meadow';
  if (r < 0.72) return 'sandbar';
  if (r < 0.86) return 'snowcap';
  return 'spooky';
}
