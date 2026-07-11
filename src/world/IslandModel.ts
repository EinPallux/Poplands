/**
 * Authoritative island shape (S8, minimal v0.1 slice): which chunks exist,
 * which world blocks are island. Occupancy/placement arrives in v0.2.
 * three.js-free on purpose? No — this lives in world/, but keeps zero three imports
 * anyway so sim code can consume it later without dragging the renderer along.
 */
import { CHUNK_SIZE, chunkKey, chunksBounds, worldToChunk, type ChunkCoord } from '@/core/grid';

export class IslandModel {
  private chunks = new Map<string, ChunkCoord>();

  constructor(initial: ChunkCoord[]) {
    for (const c of initial) this.chunks.set(chunkKey(c.cx, c.cz), c);
  }

  hasChunk(cx: number, cz: number): boolean {
    return this.chunks.has(chunkKey(cx, cz));
  }

  hasBlock(wx: number, wz: number): boolean {
    const c = worldToChunk(wx, wz);
    return this.hasChunk(c.cx, c.cz);
  }

  allChunks(): ChunkCoord[] {
    return [...this.chunks.values()];
  }

  /** World-unit bounds (min inclusive, max exclusive). */
  bounds() {
    const b = chunksBounds(this.chunks.values());
    if (!b) throw new Error('island has no chunks');
    return b;
  }

  center(): { x: number; z: number } {
    const b = this.bounds();
    return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
  }

  /** Boundary cells whose given edge faces off-island (used by the skirt builder). */
  edgeCells(): Array<{ wx: number; wz: number; nx: number; nz: number }> {
    const edges: Array<{ wx: number; wz: number; nx: number; nz: number }> = [];
    for (const c of this.chunks.values()) {
      for (let bx = 0; bx < CHUNK_SIZE; bx++) {
        for (let bz = 0; bz < CHUNK_SIZE; bz++) {
          const wx = c.cx * CHUNK_SIZE + bx;
          const wz = c.cz * CHUNK_SIZE + bz;
          for (const [nx, nz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            if (!this.hasBlock(wx + nx, wz + nz)) edges.push({ wx, wz, nx, nz });
          }
        }
      }
    }
    return edges;
  }
}
