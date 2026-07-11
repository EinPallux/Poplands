import { describe, it, expect } from 'vitest';
import { traceOutlines, refineLoop } from '@/core/outline';
import { valueNoise2 } from '@/core/math';

function makeBlockSet(cells: Array<[number, number]>) {
  const set = new Set(cells.map(([x, z]) => `${x},${z}`));
  return {
    blocks: cells.map(([wx, wz]) => ({ wx, wz })),
    hasBlock: (wx: number, wz: number) => set.has(`${wx},${wz}`),
  };
}

describe('traceOutlines', () => {
  it('traces a single square loop for a 2×2 block island', () => {
    const { blocks, hasBlock } = makeBlockSet([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]);
    const loops = traceOutlines(blocks, hasBlock);
    expect(loops).toHaveLength(1);
    const loop = loops[0]!;
    expect(loop).toHaveLength(8); // 4 corners + 4 mid-edge points
    // all points lie on the boundary square [0..2]
    for (const p of loop) {
      expect(Math.min(p.x, p.z)).toBeGreaterThanOrEqual(0);
      expect(Math.max(p.x, p.z)).toBeLessThanOrEqual(2);
      expect(p.x === 0 || p.x === 2 || p.z === 0 || p.z === 2).toBe(true);
    }
  });

  it('traces an L-shape as one loop with the correct perimeter', () => {
    // L: 2×1 row + 1×1 below-left → perimeter 8 units → 8 unit segments
    const { blocks, hasBlock } = makeBlockSet([
      [0, 0],
      [1, 0],
      [0, 1],
    ]);
    const loops = traceOutlines(blocks, hasBlock);
    expect(loops).toHaveLength(1);
    expect(loops[0]!).toHaveLength(8); // 8 unit edges → 8 points
  });

  it('emits a separate loop for a hole', () => {
    // 3×3 ring with the center missing
    const cells: Array<[number, number]> = [];
    for (let x = 0; x < 3; x++)
      for (let z = 0; z < 3; z++) if (!(x === 1 && z === 1)) cells.push([x, z]);
    const { blocks, hasBlock } = makeBlockSet(cells);
    const loops = traceOutlines(blocks, hasBlock);
    expect(loops).toHaveLength(2);
    const sizes = loops.map((l) => l.length).sort((a, b) => a - b);
    expect(sizes).toEqual([4, 12]); // inner square hole + outer boundary
  });

  it('splits diagonal touches into separate loops', () => {
    // two blocks touching only at one corner
    const { blocks, hasBlock } = makeBlockSet([
      [0, 0],
      [1, 1],
    ]);
    const loops = traceOutlines(blocks, hasBlock);
    expect(loops).toHaveLength(2);
    expect(loops[0]!).toHaveLength(4);
    expect(loops[1]!).toHaveLength(4);
  });

  it('outward normals point away from the interior', () => {
    const { blocks, hasBlock } = makeBlockSet([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]);
    const loop = traceOutlines(blocks, hasBlock)[0]!;
    const refined = refineLoop(loop, 2);
    for (const p of refined) {
      // stepping outward must leave the island; center of island is (1,1)
      const probeX = p.x + p.nx * 0.51;
      const probeZ = p.z + p.nz * 0.51;
      const inside = hasBlock(Math.floor(probeX), Math.floor(probeZ));
      // points exactly on a corner have diagonal-ish normals; those may still
      // graze a solid cell, so only assert for axis-aligned normals
      if (Math.abs(p.nx) > 0.9 || Math.abs(p.nz) > 0.9) {
        expect(inside).toBe(false);
      }
    }
  });

  it('refineLoop doubles point count and keeps unit normals', () => {
    const { blocks, hasBlock } = makeBlockSet([[0, 0]]);
    const loop = traceOutlines(blocks, hasBlock)[0]!;
    const refined = refineLoop(loop, 2);
    expect(refined).toHaveLength(loop.length * 2);
    for (const p of refined) {
      expect(Math.hypot(p.nx, p.nz)).toBeCloseTo(1, 5);
    }
  });
});

describe('valueNoise2', () => {
  it('stays in [0,1], is deterministic, and varies', () => {
    let min = 1;
    let max = 0;
    for (let i = 0; i < 500; i++) {
      const v = valueNoise2(i * 0.37, i * 0.73);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(max - min).toBeGreaterThan(0.3);
    expect(valueNoise2(3.3, 4.4)).toBe(valueNoise2(3.3, 4.4));
  });
});
