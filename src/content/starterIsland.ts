/**
 * The starter island (GDD §4/§5.1). A brand-new island is now a **blank canvas** —
 * fully empty, nothing pre-built (user 2026-07-12) — so the very first thing a player
 * does is place something themselves. The tutorial ("plant 3 wildflowers → a path →
 * a bench …") teaches building from the first tap. Kept as an (empty) list so the
 * seeding path in GameState stays a simple map; add entries here to pre-decorate.
 */
import type { Rot } from '@/core/grid';

export interface StarterPlacement {
  def: string;
  wx: number;
  wz: number;
  rot?: Rot;
}

export const STARTER_PLACEMENTS: readonly StarterPlacement[] = [];
