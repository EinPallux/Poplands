/**
 * Path/river auto-tiling (S10, v0.6): the pure neighbour-bitmask → shape+rotation
 * reduction. THREE.JS-FREE. A ground-overlay tile with a `tileKit` looks at its 4
 * orthogonal neighbours of the SAME kit and picks one of six connectivity shapes
 * (isolated/end/straight/corner/tee/cross) at a rotation, so a run of path tiles
 * reads as one connected ribbon instead of isolated squares. PropRenderer swaps the
 * instanced pool's GLB variant accordingly; placements (the truth) never change.
 */
export type Dir = 'N' | 'E' | 'S' | 'W';
export type TileShape = 'isolated' | 'end' | 'straight' | 'corner' | 'tee' | 'cross';

/** World-cell delta + bitmask bit per compass direction (N = wz-1, S = wz+1,
 *  E = wx+1, W = wx-1). The ONE place this convention is defined. */
export const DIRS: ReadonlyArray<{ dir: Dir; dx: number; dz: number; bit: number }> = [
  { dir: 'N', dx: 0, dz: -1, bit: 1 },
  { dir: 'E', dx: 1, dz: 0, bit: 2 },
  { dir: 'S', dx: 0, dz: 1, bit: 4 },
  { dir: 'W', dx: -1, dz: 0, bit: 8 },
];

// rotYaw (grid.ts) is a CCW yaw about +Y; one +rot step cycles E→N→W→S→E.
const ROTATE_CCW: Record<Dir, Dir> = { E: 'N', N: 'W', W: 'S', S: 'E' };
function rotateDir(d: Dir, rot: 0 | 1 | 2 | 3): Dir {
  let r = d;
  for (let i = 0; i < rot; i++) r = ROTATE_CCW[r];
  return r;
}

/** Each shape's open edges in its unrotated (rot=0) GLB orientation. */
const SHAPES: ReadonlyArray<{ shape: TileShape; base: readonly Dir[] }> = [
  { shape: 'isolated', base: [] },
  { shape: 'end', base: ['N'] },
  { shape: 'straight', base: ['N', 'S'] },
  { shape: 'corner', base: ['N', 'E'] },
  { shape: 'tee', base: ['N', 'E', 'W'] },
  { shape: 'cross', base: ['N', 'E', 'S', 'W'] },
];

const bitOf = (d: Dir): number => DIRS.find((x) => x.dir === d)!.bit;

const LUT: Array<{ shape: TileShape; rot: 0 | 1 | 2 | 3 }> = buildLut();
function buildLut(): Array<{ shape: TileShape; rot: 0 | 1 | 2 | 3 }> {
  const lut = new Array<{ shape: TileShape; rot: 0 | 1 | 2 | 3 }>(16);
  for (const { shape, base } of SHAPES) {
    for (const rot of [0, 1, 2, 3] as const) {
      let mask = 0;
      for (const d of base) mask |= bitOf(rotateDir(d, rot));
      if (!lut[mask]) lut[mask] = { shape, rot }; // first (lowest-rot) match wins
    }
  }
  return lut;
}

/** Neighbour bitmask (0–15, OR of DIRS[i].bit) → which GLB shape + rotation to show. */
export function resolveTileShape(mask: number): { shape: TileShape; rot: 0 | 1 | 2 | 3 } {
  return LUT[mask]!;
}
