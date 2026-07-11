import { describe, it, expect } from 'vitest';
import {
  CHUNK_SIZE,
  chunkKey,
  worldToChunk,
  worldToLocal,
  localToWorld,
  blockCenter,
  worldPosToBlock,
  rotatedSize,
  footprintCells,
  footprintCenter,
  rotYaw,
  chunksBounds,
  edgeAnchorOrigin,
} from '@/core/grid';

describe('grid math', () => {
  it('maps world blocks to chunks, including negatives', () => {
    expect(worldToChunk(0, 0)).toEqual({ cx: 0, cz: 0 });
    expect(worldToChunk(7, 7)).toEqual({ cx: 0, cz: 0 });
    expect(worldToChunk(8, 0)).toEqual({ cx: 1, cz: 0 });
    expect(worldToChunk(-1, -1)).toEqual({ cx: -1, cz: -1 });
    expect(worldToChunk(-8, -9)).toEqual({ cx: -1, cz: -2 });
  });

  it('maps world blocks to local indices in [0, CHUNK_SIZE)', () => {
    expect(worldToLocal(0, 0)).toEqual({ bx: 0, bz: 0 });
    expect(worldToLocal(-1, -8)).toEqual({ bx: CHUNK_SIZE - 1, bz: 0 });
    for (let w = -20; w < 20; w++) {
      const { bx } = worldToLocal(w, 0);
      expect(bx).toBeGreaterThanOrEqual(0);
      expect(bx).toBeLessThan(CHUNK_SIZE);
    }
  });

  it('round-trips local ↔ world', () => {
    for (const [cx, cz, bx, bz] of [
      [0, 0, 0, 0],
      [1, -2, 7, 3],
      [-3, 4, 5, 5],
    ] as const) {
      const { wx, wz } = localToWorld({ cx, cz }, bx, bz);
      expect(worldToChunk(wx, wz)).toEqual({ cx, cz });
      expect(worldToLocal(wx, wz)).toEqual({ bx, bz });
    }
  });

  it('computes block centers and reverse lookup', () => {
    expect(blockCenter(0, 0)).toEqual({ x: 0.5, z: 0.5 });
    expect(worldPosToBlock(0.5, 0.5)).toEqual({ wx: 0, wz: 0 });
    expect(worldPosToBlock(-0.2, 7.99)).toEqual({ wx: -1, wz: 7 });
  });

  it('rotates footprints (odd rotations swap w/d)', () => {
    const fp = { w: 3, d: 5 };
    expect(rotatedSize(fp, 0)).toEqual({ w: 3, d: 5 });
    expect(rotatedSize(fp, 1)).toEqual({ w: 5, d: 3 });
    expect(rotatedSize(fp, 2)).toEqual({ w: 3, d: 5 });
    expect(rotatedSize(fp, 3)).toEqual({ w: 5, d: 3 });
  });

  it('enumerates footprint cells from the min-corner anchor', () => {
    const cells = footprintCells(10, 20, { w: 2, d: 3 }, 0);
    expect(cells).toHaveLength(6);
    expect(cells).toContainEqual({ wx: 10, wz: 20 });
    expect(cells).toContainEqual({ wx: 11, wz: 22 });
    const rotated = footprintCells(10, 20, { w: 2, d: 3 }, 1);
    expect(rotated).toHaveLength(6);
    expect(rotated).toContainEqual({ wx: 12, wz: 21 });
  });

  it('footprint center matches cell extents', () => {
    expect(footprintCenter(0, 0, { w: 2, d: 4 }, 0)).toEqual({ x: 1, z: 2 });
    expect(footprintCenter(0, 0, { w: 2, d: 4 }, 1)).toEqual({ x: 2, z: 1 });
  });

  it('rotYaw covers the four quarter turns', () => {
    expect(rotYaw(0)).toBe(0);
    expect(rotYaw(2)).toBeCloseTo(Math.PI);
  });

  it('bounds a set of chunks in world units', () => {
    const b = chunksBounds([
      { cx: 0, cz: 0 },
      { cx: 1, cz: 1 },
    ]);
    expect(b).toEqual({ minX: 0, minZ: 0, maxX: 16, maxZ: 16 });
    expect(chunksBounds([])).toBeNull();
  });

  it('chunkKey is stable and unique per coordinate', () => {
    expect(chunkKey(1, -2)).toBe('1,-2');
    expect(chunkKey(1, -2)).not.toBe(chunkKey(-1, 2));
  });

  it('edgeAnchorOrigin shifts back only for negative-facing rotations (S8)', () => {
    const fp = { w: 2, d: 2 };
    const a = { wx: 10, wz: 10 };
    expect(edgeAnchorOrigin(a, fp, 0)).toEqual({ wx: 10, wz: 10 }); // +Z, no shift
    expect(edgeAnchorOrigin(a, fp, 1)).toEqual({ wx: 10, wz: 10 }); // +X, no shift
    expect(edgeAnchorOrigin(a, fp, 2)).toEqual({ wx: 10, wz: 9 }); // -Z, wz back by d-1
    expect(edgeAnchorOrigin(a, fp, 3)).toEqual({ wx: 9, wz: 10 }); // -X, wx back by w-1
  });
});
