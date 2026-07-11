/**
 * Grid & chunk math — the spatial contract of Poplands (TECH §5).
 *
 * - 1 block = 1 world unit, Y-up, ground surface at y = 0.
 * - A chunk is CHUNK_SIZE × CHUNK_SIZE blocks on an integer chunk lattice (cx, cz).
 * - World block coordinates (wx, wz) are integers addressing a block's MIN corner;
 *   a block's mesh/center sits at (wx + 0.5, wz + 0.5).
 *
 * Pure functions only. This file is deliberately the most unit-tested in the repo.
 */
import { fdiv, emod } from './math';

export const CHUNK_SIZE = 8;

export interface ChunkCoord {
  cx: number;
  cz: number;
}

/** Rotation in 90° steps: 0=0°, 1=90°, 2=180°, 3=270° (counter-clockwise around +Y). */
export type Rot = 0 | 1 | 2 | 3;

/** A chunk's biome (S7/v0.6): drives ground/lip colours and (later) theme secrets. */
export type ChunkTheme = 'meadow' | 'sandbar' | 'spooky' | 'snowcap';

export interface Footprint {
  w: number; // blocks along +X at rot 0
  d: number; // blocks along +Z at rot 0
}

/** Stable string key for a chunk coordinate (Map-friendly). */
export const chunkKey = (cx: number, cz: number): string => `${cx},${cz}`;

export const worldToChunk = (wx: number, wz: number): ChunkCoord => ({
  cx: fdiv(wx, CHUNK_SIZE),
  cz: fdiv(wz, CHUNK_SIZE),
});

/** Block index within its chunk, always in [0, CHUNK_SIZE). */
export const worldToLocal = (wx: number, wz: number): { bx: number; bz: number } => ({
  bx: emod(wx, CHUNK_SIZE),
  bz: emod(wz, CHUNK_SIZE),
});

export const localToWorld = (c: ChunkCoord, bx: number, bz: number): { wx: number; wz: number } => ({
  wx: c.cx * CHUNK_SIZE + bx,
  wz: c.cz * CHUNK_SIZE + bz,
});

/** Center of a block's top face in world XZ. */
export const blockCenter = (wx: number, wz: number): { x: number; z: number } => ({
  x: wx + 0.5,
  z: wz + 0.5,
});

/** Continuous world position → the block containing it. */
export const worldPosToBlock = (x: number, z: number): { wx: number; wz: number } => ({
  wx: Math.floor(x),
  wz: Math.floor(z),
});

/** Footprint dimensions after rotation (odd rotations swap w/d). */
export const rotatedSize = (fp: Footprint, rot: Rot): Footprint =>
  rot % 2 === 0 ? { w: fp.w, d: fp.d } : { w: fp.d, d: fp.w };

/**
 * All world blocks covered by a footprint anchored at its MIN corner (wx, wz).
 * The anchor is the min corner AFTER rotation — callers snap the ghost so the
 * footprint always extends toward +X/+Z from the anchor.
 */
export function footprintCells(wx: number, wz: number, fp: Footprint, rot: Rot): Array<{ wx: number; wz: number }> {
  const { w, d } = rotatedSize(fp, rot);
  const cells: Array<{ wx: number; wz: number }> = [];
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      cells.push({ wx: wx + dx, wz: wz + dz });
    }
  }
  return cells;
}

/** Center (world XZ) of a rotated footprint anchored at min corner (wx, wz). */
export function footprintCenter(
  wx: number,
  wz: number,
  fp: Footprint,
  rot: Rot,
): { x: number; z: number } {
  const { w, d } = rotatedSize(fp, rot);
  return { x: wx + w / 2, z: wz + d / 2 };
}

/** Yaw (radians around +Y) for a rotation step. */
export const rotYaw = (rot: Rot): number => (rot * Math.PI) / 2;

/** Outward-facing unit normal for an edge-anchor item at a given rotation
 *  (rotating a canonical +Z-facing mesh by rotYaw cycles +Z → +X → -Z → -X). */
export const facingNormal = (rot: Rot): { nx: number; nz: number } =>
  (
    [
      { nx: 0, nz: 1 },
      { nx: 1, nz: 0 },
      { nx: 0, nz: -1 },
      { nx: -1, nz: 0 },
    ] as const
  )[rot];

/**
 * Effective footprint origin for an edge-anchor item (S8). `footprintCells`
 * always grows toward +X/+Z from its origin, and the hovered anchor cell is
 * always on-island (input only hovers island cells) — so a rotation facing
 * -X/-Z needs the origin pulled BACK by (size-1) along that axis, putting the
 * anchor cell at the far (land) end of the rectangle. This is what lets a dock
 * be rotated onto the island's south/west edges, not just north/east.
 */
export function edgeAnchorOrigin(
  anchor: { wx: number; wz: number },
  fp: Footprint,
  rot: Rot,
): { wx: number; wz: number } {
  const { w, d } = rotatedSize(fp, rot);
  const { nx, nz } = facingNormal(rot);
  return {
    wx: nx < 0 ? anchor.wx - (w - 1) : anchor.wx,
    wz: nz < 0 ? anchor.wz - (d - 1) : anchor.wz,
  };
}

/** Axis-aligned bounds of a set of chunks, in world units (min inclusive, max exclusive). */
export function chunksBounds(chunks: Iterable<ChunkCoord>): {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
} | null {
  let minCx = Infinity;
  let minCz = Infinity;
  let maxCx = -Infinity;
  let maxCz = -Infinity;
  let any = false;
  for (const c of chunks) {
    any = true;
    if (c.cx < minCx) minCx = c.cx;
    if (c.cz < minCz) minCz = c.cz;
    if (c.cx > maxCx) maxCx = c.cx;
    if (c.cz > maxCz) maxCz = c.cz;
  }
  if (!any) return null;
  return {
    minX: minCx * CHUNK_SIZE,
    minZ: minCz * CHUNK_SIZE,
    maxX: (maxCx + 1) * CHUNK_SIZE,
    maxZ: (maxCz + 1) * CHUNK_SIZE,
  };
}
