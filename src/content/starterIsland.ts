/**
 * The starter island (GDD §4/§5.1) as REAL placements — LIGHTLY decorated with
 * ambient framing (trees, rocks, grass at the rims) so it photographs well from
 * second zero, while leaving the interior open for the tutorial to teach
 * building (flowers → path → bench → stall → hut …). Everything here is movable
 * and removable. The windmill is a separate landmark (world/StarterIsland.ts).
 *
 * Deliberately excludes flowers, paths, benches, stalls, homes, lanterns — the
 * things the tutorial hands the player — so a fresh save's tutorial has room.
 */
import type { Rot } from '@/core/grid';

export interface StarterPlacement {
  def: string;
  wx: number;
  wz: number;
  rot?: Rot;
}

export const STARTER_PLACEMENTS: readonly StarterPlacement[] = [
  // trees & pines framing the corners/edges (tall interest, kept off-center)
  { def: 'nature.tree', wx: 2, wz: 12 },
  { def: 'nature.tree', wx: 13, wz: 2, rot: 2 },
  { def: 'nature.tree', wx: 14, wz: 13, rot: 1 },
  { def: 'nature.pine', wx: 1, wz: 8 },
  { def: 'nature.pine', wx: 6, wz: 1, rot: 3 },
  { def: 'nature.bush', wx: 3, wz: 10 },
  { def: 'nature.bush', wx: 13, wz: 7, rot: 1 },

  // small life scattered toward the rims — reads as an untouched meadow
  { def: 'nature.grass', wx: 2, wz: 5 },
  { def: 'nature.grass', wx: 14, wz: 9, rot: 1 },
  { def: 'nature.grass', wx: 4, wz: 14, rot: 3 },
  { def: 'nature.grass', wx: 15, wz: 4 },
  { def: 'nature.mushroom', wx: 1, wz: 14 },
  { def: 'nature.rock', wx: 15, wz: 12 },
  { def: 'nature.rock', wx: 1, wz: 2, rot: 2 },
  { def: 'nature.pebble', wx: 14, wz: 15 },
  { def: 'decor.stump', wx: 0, wz: 11 },
];
