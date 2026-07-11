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
  type ChunkTheme,
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

export type BlockReason = 'off-island' | 'occupied' | 'needs-edge';

interface CellOccupancy {
  prop?: PlacementId;
  ground?: PlacementId;
}

const cellKey = (wx: number, wz: number): string => `${wx},${wz}`;

export class IslandModel {
  private chunks = new Map<string, ChunkCoord>();
  private themes = new Map<string, ChunkTheme>();
  private cells = new Map<string, CellOccupancy>();
  private placements = new Map<PlacementId, Placement>();
  /** Cells claimed by landmarks (the old windmill) — blocked but not placements. */
  private blocked = new Set<string>();
  private nextId = 1;

  constructor(initial: Array<ChunkCoord & { theme?: ChunkTheme }>) {
    for (const c of initial) {
      const k = chunkKey(c.cx, c.cz);
      this.chunks.set(k, { cx: c.cx, cz: c.cz });
      this.themes.set(k, c.theme ?? 'meadow');
    }
  }

  /** A chunk's biome (S7/v0.6), defaulting to meadow. */
  themeAt(cx: number, cz: number): ChunkTheme {
    return this.themes.get(chunkKey(cx, cz)) ?? 'meadow';
  }

  /** The biome of the chunk a world block belongs to. */
  themeAtBlock(wx: number, wz: number): ChunkTheme {
    const c = worldToChunk(wx, wz);
    return this.themeAt(c.cx, c.cz);
  }

  // ——— chunks ———

  hasChunk(cx: number, cz: number): boolean {
    return this.chunks.has(chunkKey(cx, cz));
  }

  get chunkCount(): number {
    return this.chunks.size;
  }

  /** Add a chunk to the lattice (S7 expansion). Idempotent; returns false if it
   *  already existed. Blocks/bounds/outline all derive from the chunk set, so the
   *  world visuals just rebuild from the new shape. */
  addChunk(cx: number, cz: number, theme: ChunkTheme = 'meadow'): boolean {
    const k = chunkKey(cx, cz);
    if (this.chunks.has(k)) return false;
    this.chunks.set(k, { cx, cz });
    this.themes.set(k, theme);
    return true;
  }

  /** Unowned chunk cells edge-adjacent to the island — the survey candidates (S8).
   *  Deterministically ordered (by cz, then cx) so offers are stable/reproducible.
   *  Every slot is lattice-connected by construction (no detached islands). */
  expandableSlots(): ChunkCoord[] {
    const seen = new Set<string>();
    const out: ChunkCoord[] = [];
    for (const c of this.chunks.values()) {
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = c.cx + dx;
        const nz = c.cz + dz;
        const k = chunkKey(nx, nz);
        if (this.chunks.has(k) || seen.has(k)) continue;
        seen.add(k);
        out.push({ cx: nx, cz: nz });
      }
    }
    out.sort((a, b) => a.cz - b.cz || a.cx - b.cx);
    return out;
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

  /** Can an agent stand on this cell (S16)? On-island, not landmark-blocked, and
   *  free of a solid prop. Ground overlays (paths) live in `occ.ground`, so a path
   *  tile leaves `occ.prop` undefined and reads as walkable — Islanders stroll the
   *  paths but never clip through benches or huts. Three.js-free (sim consumes it). */
  walkable(wx: number, wz: number): boolean {
    if (!this.hasBlock(wx, wz)) return false;
    const k = cellKey(wx, wz);
    if (this.blocked.has(k)) return false;
    return this.cells.get(k)?.prop === undefined;
  }

  canPlace(def: ItemDef, wx: number, wz: number, rot: Rot): { ok: true } | { ok: false; reason: BlockReason } {
    if (def.edgeAnchor) return this.canPlaceEdgeAnchor(def, wx, wz, rot);
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

  /** Edge-anchor items (S8) straddle the boundary on purpose: the footprint must
   *  include ≥1 on-island cell (the anchor — solid ground, validated like a normal
   *  placement) AND ≥1 off-island cell (the overhang). Off-island cells skip the
   *  hasBlock requirement but still can't overlap an existing prop, so two docks
   *  can't share an overhang (occupancy is checked for every cell, on or off). */
  private canPlaceEdgeAnchor(
    def: ItemDef,
    wx: number,
    wz: number,
    rot: Rot,
  ): { ok: true } | { ok: false; reason: BlockReason } {
    const cells = footprintCells(wx, wz, def.footprint, rot);
    let onIsland = 0;
    for (const cell of cells) {
      const k = cellKey(cell.wx, cell.wz);
      if (this.hasBlock(cell.wx, cell.wz)) {
        onIsland++;
        if (!def.groundOverlay && this.blocked.has(k)) return { ok: false, reason: 'occupied' };
      }
      const occ = this.cells.get(k);
      if (occ && (def.groundOverlay ? occ.ground !== undefined : occ.prop !== undefined)) {
        return { ok: false, reason: 'occupied' };
      }
    }
    if (onIsland === 0) return { ok: false, reason: 'off-island' };
    if (onIsland === cells.length) return { ok: false, reason: 'needs-edge' };
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
