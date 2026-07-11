/**
 * The pre-decorated starter island (GDD §5.1) as REAL placements — everything
 * the player sees on a fresh save is movable and removable from second one.
 * Coordinates are min-corner anchors on the 16×16 (2×2-chunk) starter grid.
 * The old windmill is a separate landmark (world/StarterIsland.ts), not a placement.
 */
import type { Rot } from '@/core/grid';

export interface StarterPlacement {
  def: string;
  wx: number;
  wz: number;
  rot?: Rot;
}

export const STARTER_PLACEMENTS: readonly StarterPlacement[] = [
  // buildings
  { def: 'home.house', wx: 9, wz: 3, rot: 2 }, // door toward the path
  { def: 'income.stall', wx: 12, wz: 10, rot: 1 },

  // stone path: house door → south → west toward the garden
  { def: 'ground.path.stone', wx: 10, wz: 7 },
  { def: 'ground.path.stone', wx: 10, wz: 8 },
  { def: 'ground.path.stone', wx: 10, wz: 9 },
  { def: 'ground.path.stone', wx: 10, wz: 10 },
  { def: 'ground.path.stone', wx: 9, wz: 10 },
  { def: 'ground.path.stone', wx: 8, wz: 10 },
  { def: 'ground.path.stone', wx: 7, wz: 10 },
  { def: 'ground.path.stone', wx: 6, wz: 10 },
  { def: 'ground.path.stone', wx: 5, wz: 10 },

  // fenced flower garden
  { def: 'decor.fence', wx: 4, wz: 8 },
  { def: 'decor.fence.gate', wx: 5, wz: 8 },
  { def: 'decor.fence', wx: 6, wz: 8 },
  { def: 'nature.flower.purple', wx: 4, wz: 5 },
  { def: 'nature.flower.red', wx: 5, wz: 5 },
  { def: 'nature.flower.yellow', wx: 6, wz: 5 },
  { def: 'nature.flower.red', wx: 4, wz: 7 },
  { def: 'nature.flower.yellow', wx: 5, wz: 6 },
  { def: 'nature.flower.purple', wx: 6, wz: 7 },

  // seating & light along the path
  { def: 'decor.bench', wx: 7, wz: 11, rot: 2 },
  { def: 'decor.lantern', wx: 6, wz: 9 },
  { def: 'decor.lantern', wx: 11, wz: 10 },
  { def: 'decor.pot', wx: 6, wz: 12 },
  { def: 'decor.sign', wx: 11, wz: 8, rot: 1 },

  // flowers near the stall
  { def: 'nature.flower.purple', wx: 14, wz: 12 },
  { def: 'nature.flower.red', wx: 12, wz: 13 },

  // trees & shrubs framing the edges
  { def: 'nature.tree', wx: 2, wz: 12 },
  { def: 'nature.tree', wx: 13, wz: 2, rot: 2 },
  { def: 'nature.tree', wx: 14, wz: 13, rot: 1 },
  { def: 'nature.pine', wx: 1, wz: 8 },
  { def: 'nature.pine', wx: 6, wz: 2, rot: 3 },
  { def: 'nature.bush', wx: 3, wz: 10 },
  { def: 'nature.bush', wx: 12, wz: 7, rot: 1 },
  { def: 'nature.bush', wx: 8, wz: 3, rot: 2 },
  { def: 'nature.clover', wx: 12, wz: 4 },
  { def: 'nature.fern', wx: 0, wz: 6 },

  // small life scattered toward the rims
  { def: 'nature.grass', wx: 2, wz: 5 },
  { def: 'nature.grass', wx: 8, wz: 13, rot: 1 },
  { def: 'nature.grass', wx: 13, wz: 6, rot: 2 },
  { def: 'nature.grass', wx: 4, wz: 9, rot: 3 },
  { def: 'nature.grass', wx: 10, wz: 2 },
  { def: 'nature.grass', wx: 15, wz: 9, rot: 1 },
  { def: 'nature.grass', wx: 0, wz: 3 },
  { def: 'nature.mushroom', wx: 1, wz: 14 },
  { def: 'nature.rock', wx: 15, wz: 8 },
  { def: 'nature.rock', wx: 2, wz: 2, rot: 2 },
  { def: 'nature.pebble', wx: 3, wz: 13 },
  { def: 'decor.stump', wx: 0, wz: 11 },
];
