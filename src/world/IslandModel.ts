/**
 * Authoritative island state (S8): chunk set, placements, and two-layer cell
 * occupancy (ground overlays under props — a path and a bench share a cell).
 * Deliberately three.js-free so simulation & tests can consume it headless.
 */
import {
  CHUNK_SIZE,
  chunkKey,
  chunksBounds,
  footprintCells,
  worldToChunk,
  type ChunkCoord,
  type Rot,
} from '@/core/grid';
import { itemDef, type ItemDef } from '@/content/catalog';

export type PlacementId = string;

export interface Placement {
  id: PlacementId;
  def: string; // ItemDef id (stable content contract)
  wx: number;
  wz: number;
  rot: Rot;
}

export type BlockReason = 'off-island' | 'occupied';

interface CellOccupancy {
  prop?: PlacementId;
  ground?: PlacementId;
}

const cellKey = (wx: number, wz: number): string => `${wx},${wz}`;

export class IslandModel {
  private chunks = new Map<string, ChunkCoord>();
  private cells = new Map<string, CellOccupancy>();
  private placements = new Map<PlacementId, Placement>();
  /** Cells claimed by landmarks (the old windmill) — blocked but not placements. */
  private blocked = new Set<string>();
  private nextId = 1;

  constructor(initial: ChunkCoord[]) {
    for (const c of initial) this.chunks.set(chunkKey(c.cx, c.cz), c);
  }

  // ——— chunks ———

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

  allBlocks(): Array<{ wx: number; wz: number }> {
    const out: Array<{ wx: number; wz: number }> = [];
    for (const c of this.chunks.values()) {
      for (let bx = 0; bx < CHUNK_SIZE; bx++) {
        for (let bz = 0; bz < CHUNK_SIZE; bz++) {
          out.push({ wx: c.cx * CHUNK_SIZE + bx, wz: c.cz * CHUNK_SIZE + bz });
        }
      }
    }
    return out;
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

  // ——— placements & occupancy ———

  allPlacements(): Placement[] {
    return [...this.placements.values()];
  }

  placement(id: PlacementId): Placement | undefined {
    return this.placements.get(id);
  }

  /** Topmost occupant of a cell (prop wins over ground overlay). */
  occupantAt(wx: number, wz: number, opts?: { preferGround?: boolean }): Placement | undefined {
    const cell = this.cells.get(cellKey(wx, wz));
    if (!cell) return undefined;
    const id = opts?.preferGround ? (cell.ground ?? cell.prop) : (cell.prop ?? cell.ground);
    return id ? this.placements.get(id) : undefined;
  }

  /** Landmarks claim cells without being placements (immovable in v0.2). */
  markBlocked(cells: Array<{ wx: number; wz: number }>): void {
    for (const c of cells) this.blocked.add(cellKey(c.wx, c.wz));
  }

  canPlace(def: ItemDef, wx: number, wz: number, rot: Rot): { ok: true } | { ok: false; reason: BlockReason } {
    for (const cell of footprintCells(wx, wz, def.footprint, rot)) {
      if (!this.hasBlock(cell.wx, cell.wz)) return { ok: false, reason: 'off-island' };
      const k = cellKey(cell.wx, cell.wz);
      if (!def.groundOverlay && this.blocked.has(k)) return { ok: false, reason: 'occupied' };
      const occ = this.cells.get(k);
      if (occ && (def.groundOverlay ? occ.ground !== undefined : occ.prop !== undefined)) {
        return { ok: false, reason: 'occupied' };
      }
    }
    return { ok: true };
  }

  /** Insert a placement (assumes canPlace succeeded). Returns the record. */
  place(defId: string, wx: number, wz: number, rot: Rot, id?: PlacementId): Placement {
    const def = itemDef(defId);
    if (!def) throw new Error(`unknown item def: ${defId}`);
    const placement: Placement = { id: id ?? `p${this.nextId++}`, def: defId, wx, wz, rot };
    if (id) {
      const numeric = Number(id.slice(1));
      if (Number.isFinite(numeric)) this.nextId = Math.max(this.nextId, numeric + 1);
    }
    this.placements.set(placement.id, placement);
    for (const cell of footprintCells(wx, wz, def.footprint, rot)) {
      const k = cellKey(cell.wx, cell.wz);
      const occ = this.cells.get(k) ?? {};
      if (def.groundOverlay) occ.ground = placement.id;
      else occ.prop = placement.id;
      this.cells.set(k, occ);
    }
    return placement;
  }

  /** Remove a placement and free its cells. Returns the removed record. */
  remove(id: PlacementId): Placement | undefined {
    const placement = this.placements.get(id);
    if (!placement) return undefined;
    const def = itemDef(placement.def);
    this.placements.delete(id);
    if (def) {
      for (const cell of footprintCells(placement.wx, placement.wz, def.footprint, placement.rot)) {
        const k = cellKey(cell.wx, cell.wz);
        const occ = this.cells.get(k);
        if (!occ) continue;
        if (occ.prop === id) delete occ.prop;
        if (occ.ground === id) delete occ.ground;
        if (occ.prop === undefined && occ.ground === undefined) this.cells.delete(k);
      }
    }
    return placement;
  }

  /** Serialization support (S3). */
  snapshotPlacements(): Array<{ id: string; def: string; wx: number; wz: number; rot: Rot }> {
    return this.allPlacements().map((p) => ({ ...p }));
  }

  get placementCount(): number {
    return this.placements.size;
  }

  /** Boundary cells whose given edge faces off-island (used by base/skirt builders). */
  edgeCells(): Array<{ wx: number; wz: number; nx: number; nz: number }> {
    const edges: Array<{ wx: number; wz: number; nx: number; nz: number }> = [];
    for (const { wx, wz } of this.allBlocks()) {
      for (const [nx, nz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        if (!this.hasBlock(wx + nx, wz + nz)) edges.push({ wx, wz, nx, nz });
      }
    }
    return edges;
  }
}
