/**
 * Auto-tile kits (S10, v0.6) as data: which manifest GLB variant renders each
 * connectivity shape for a `tileKit`. A shape with no art degrades to `fallback`
 * (today's static square) — so the partial stone-path kit "just works" without a
 * code special-case. Content-as-data, mirrors themes.ts.
 */
import type { TileShape } from '@/core/autotile';

export interface TileKit {
  /** Model for 'isolated' + fallback for any shape without dedicated art. */
  fallback: string;
  variants: Partial<Record<Exclude<TileShape, 'isolated'>, string>>;
}

export const TILE_KITS: Record<string, TileKit> = {
  'dirt-path': {
    fallback: 'ground.path-dirt',
    variants: {
      end: 'ground.path-dirt-end',
      straight: 'ground.path-dirt-straight',
      corner: 'ground.path-dirt-corner',
      tee: 'ground.path-dirt-tee',
      cross: 'ground.path-dirt-cross',
    },
  },
  'stone-path': {
    fallback: 'ground.path-stone', // plain paver also covers straight/tee/cross (no art)
    variants: {
      end: 'ground.path-stone-end',
      corner: 'ground.path-stone-corner',
    },
  },
  river: {
    fallback: 'ground.river',
    variants: {
      end: 'ground.river-end',
      straight: 'ground.river-straight',
      corner: 'ground.river-corner',
      tee: 'ground.river-tee',
      cross: 'ground.river-cross',
    },
  },
};
