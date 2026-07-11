import { describe, it, expect, beforeEach } from 'vitest';
import { IslandModel } from '@/world/IslandModel';
import { itemDef } from '@/content/catalog';

const CHUNKS = [
  { cx: 0, cz: 0 },
  { cx: 1, cz: 0 },
  { cx: 0, cz: 1 },
  { cx: 1, cz: 1 },
];

describe('IslandModel occupancy & placements', () => {
  let island: IslandModel;

  beforeEach(() => {
    island = new IslandModel(CHUNKS);
  });

  it('places and removes a 1×1 item', () => {
    const def = itemDef('nature.tree')!;
    expect(island.canPlace(def, 3, 3, 0)).toEqual({ ok: true });
    const p = island.place(def.id, 3, 3, 0);
    expect(island.occupantAt(3, 3)?.id).toBe(p.id);
    expect(island.canPlace(def, 3, 3, 0)).toEqual({ ok: false, reason: 'occupied' });
    island.remove(p.id);
    expect(island.occupantAt(3, 3)).toBeUndefined();
    expect(island.canPlace(def, 3, 3, 0).ok).toBe(true);
  });

  it('validates full footprints incl. cross-chunk placement', () => {
    const hut = itemDef('home.hut')!; // 3×3
    // straddles the chunk border at x=8
    expect(island.canPlace(hut, 7, 3, 0).ok).toBe(true);
    island.place(hut.id, 7, 3, 0);
    // every covered cell is occupied
    for (let x = 7; x <= 9; x++)
      for (let z = 3; z <= 5; z++) expect(island.occupantAt(x, z)).toBeDefined();
    // overlapping placement is rejected
    expect(island.canPlace(itemDef('nature.bush')!, 9, 5, 0)).toEqual({
      ok: false,
      reason: 'occupied',
    });
  });

  it('rejects out-of-island footprints', () => {
    const bench = itemDef('decor.bench')!; // 2×1
    expect(island.canPlace(bench, 15, 0, 0)).toEqual({ ok: false, reason: 'off-island' });
    expect(island.canPlace(bench, 15, 0, 1).ok).toBe(true); // rotated fits along the edge
  });

  it('rotation swaps footprint occupancy', () => {
    const bench = itemDef('decor.bench')!; // 2×1
    island.place(bench.id, 4, 4, 1); // rotated → occupies (4,4) and (4,5)
    expect(island.occupantAt(4, 5)).toBeDefined();
    expect(island.occupantAt(5, 4)).toBeUndefined();
  });

  it('ground overlays coexist with props in the same cell', () => {
    const path = itemDef('ground.path.stone')!;
    const flower = itemDef('nature.flower.red')!;
    island.place(path.id, 5, 5, 0);
    expect(island.canPlace(flower, 5, 5, 0).ok).toBe(true);
    const f = island.place(flower.id, 5, 5, 0);
    // prop wins default lookup; ground reachable via preference flag
    expect(island.occupantAt(5, 5)?.id).toBe(f.id);
    expect(island.occupantAt(5, 5, { preferGround: true })?.def).toBe(path.id);
    // second path in the same cell is blocked
    expect(island.canPlace(itemDef('ground.path.dirt')!, 5, 5, 0)).toEqual({
      ok: false,
      reason: 'occupied',
    });
  });

  it('keeps ids unique across explicit-id restores', () => {
    island.place('nature.tree', 1, 1, 0, 'p7');
    const next = island.place('nature.bush', 2, 2, 0);
    expect(next.id).not.toBe('p7');
    expect(Number(next.id.slice(1))).toBeGreaterThan(7);
  });
});
