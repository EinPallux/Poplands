/**
 * Boundary tracing for the island's block footprint (used by the base-slab
 * builder). Produces closed loops of grid-corner points with the island
 * interior always on the LEFT of the walking direction — so the outward
 * normal of any segment is its right-hand side.
 *
 * Handles arbitrary chunk shapes including holes (each hole becomes its own
 * loop) and diagonal touches (resolved by preferring the tightest left turn,
 * which splits pinched loops cleanly).
 */

export interface OutlinePoint {
  x: number;
  z: number;
}

interface DirectedEdge {
  sx: number;
  sz: number;
  ex: number;
  ez: number;
}

const key = (x: number, z: number): string => `${x},${z}`;

/**
 * Trace all boundary loops of a block set.
 * `blocks` enumerates every solid block (by min corner); `hasBlock` tests membership.
 */
export function traceOutlines(
  blocks: Iterable<{ wx: number; wz: number }>,
  hasBlock: (wx: number, wz: number) => boolean,
): OutlinePoint[][] {
  // Collect directed boundary edges (interior on the left of s→e).
  const edges: DirectedEdge[] = [];
  for (const { wx, wz } of blocks) {
    if (!hasBlock(wx, wz - 1)) edges.push({ sx: wx + 1, sz: wz, ex: wx, ez: wz }); // north side
    if (!hasBlock(wx, wz + 1)) edges.push({ sx: wx, sz: wz + 1, ex: wx + 1, ez: wz + 1 }); // south side
    if (!hasBlock(wx - 1, wz)) edges.push({ sx: wx, sz: wz, ex: wx, ez: wz + 1 }); // west side
    if (!hasBlock(wx + 1, wz)) edges.push({ sx: wx + 1, sz: wz + 1, ex: wx + 1, ez: wz }); // east side
  }

  const byStart = new Map<string, DirectedEdge[]>();
  for (const e of edges) {
    const k = key(e.sx, e.sz);
    const list = byStart.get(k);
    if (list) list.push(e);
    else byStart.set(k, [e]);
  }

  // Left-turn score of going from direction (dx1,dz1) into (dx2,dz2):
  // higher = tighter left turn. cross > 0 is a left turn in our orientation.
  const turnScore = (dx1: number, dz1: number, dx2: number, dz2: number): number => {
    const cross = dx1 * dz2 - dz1 * dx2;
    const dot = dx1 * dx2 + dz1 * dz2;
    if (cross > 0) return 3; // left
    if (cross === 0 && dot > 0) return 2; // straight
    if (cross === 0) return 0; // U-turn (shouldn't happen)
    return 1; // right
  };

  const loops: OutlinePoint[][] = [];
  for (const startEdge of edges) {
    if (startEdge.sx === Number.POSITIVE_INFINITY) continue; // consumed marker
    // consume this edge and walk until the loop closes
    const loop: OutlinePoint[] = [{ x: startEdge.sx, z: startEdge.sz }];
    let current = startEdge;
    for (;;) {
      // mark consumed (remove from its start bucket)
      const bucket = byStart.get(key(current.sx, current.sz));
      if (bucket) {
        const i = bucket.indexOf(current);
        if (i >= 0) bucket.splice(i, 1);
      }
      current.sx = Number.POSITIVE_INFINITY; // consumed marker

      const endX = current.ex;
      const endZ = current.ez;
      if (endX === (loop[0] as OutlinePoint).x && endZ === (loop[0] as OutlinePoint).z) break; // closed
      loop.push({ x: endX, z: endZ });

      const candidates = byStart.get(key(endX, endZ));
      if (!candidates || candidates.length === 0) {
        // Should not happen on well-formed input; abandon this partial loop.
        loop.length = 0;
        break;
      }
      const inDx = endX - current.sx; // incoming direction
      const inDz = endZ - current.sz;
      let best = candidates[0] as DirectedEdge;
      let bestScore = -1;
      for (const cand of candidates) {
        const s = turnScore(inDx, inDz, cand.ex - cand.sx, cand.ez - cand.sz);
        if (s > bestScore) {
          bestScore = s;
          best = cand;
        }
      }
      current = best;
    }
    if (loop.length >= 4) loops.push(loop);
  }
  return loops;
}

/**
 * Subdivide each unit segment of a loop into `parts` and return points with
 * per-point outward normals (right-hand side of the walk, since interior is left).
 */
export function refineLoop(
  loop: OutlinePoint[],
  parts = 2,
): Array<{ x: number; z: number; nx: number; nz: number }> {
  const pts: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i] as OutlinePoint;
    const b = loop[(i + 1) % loop.length] as OutlinePoint;
    for (let p = 0; p < parts; p++) {
      const t = p / parts;
      pts.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return pts.map((pt, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length] as OutlinePoint;
    const next = pts[(i + 1) % pts.length] as OutlinePoint;
    let dx = next.x - prev.x;
    let dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    // outward = right of walking direction (interior is on the left)
    return { x: pt.x, z: pt.z, nx: -dz, nz: dx };
  });
}
