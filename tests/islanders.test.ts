import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IslanderSystem } from '@/sim/IslanderSystem';
import { IslandModel } from '@/world/IslandModel';
import { freshIslanders, type SaveIslanders } from '@/core/save';
import { ISLANDERS, MAX_ISLANDERS } from '@/content/roster';
import { itemDef } from '@/content/catalog';
import { bus } from '@/core/events';

/** 3×3 chunk island (24×24 blocks) — roomy enough for many homes. */
const CHUNKS = [
  { cx: 0, cz: 0 },
  { cx: 1, cz: 0 },
  { cx: 2, cz: 0 },
  { cx: 0, cz: 1 },
  { cx: 1, cz: 1 },
  { cx: 2, cz: 1 },
  { cx: 0, cz: 2 },
  { cx: 1, cz: 2 },
  { cx: 2, cz: 2 },
];

let island: IslandModel;
let state: SaveIslanders;
let sys: IslanderSystem;
let arrived: string[];
const offs: Array<() => void> = [];

function place(def: string, wx: number, wz: number, id: string) {
  island.place(def, wx, wz, 0, id);
  bus.emit('item:placed', { id, def, wx, wz, rot: 0 });
}

beforeEach(() => {
  island = new IslandModel(CHUNKS);
  state = freshIslanders();
  arrived = [];
  offs.push(bus.on('npc:arrived', (e) => arrived.push(e.id)));
  sys = new IslanderSystem(island, state, 12345);
  sys.wire();
});

afterEach(() => {
  sys.dispose();
  for (const off of offs) off();
  offs.length = 0;
});

describe('IslandModel.walkable (S16)', () => {
  it('is true for empty on-island cells and paths, false for props/off-island/blocked', () => {
    expect(island.walkable(5, 5)).toBe(true); // empty ground
    expect(island.walkable(-1, 0)).toBe(false); // off-island
    expect(island.walkable(100, 100)).toBe(false); // off-island

    place('ground.path.dirt', 5, 5, 'path1'); // ground overlay
    expect(island.walkable(5, 5)).toBe(true); // strollable

    place('nature.tree', 6, 6, 'tree1'); // solid prop
    expect(island.walkable(6, 6)).toBe(false);

    island.markBlocked([{ wx: 7, wz: 7 }]); // landmark cell
    expect(island.walkable(7, 7)).toBe(false);
  });
});

describe('IslanderSystem population (S16)', () => {
  it('welcomes nobody until a home exists', () => {
    sys.announce();
    expect(state.residents).toHaveLength(0);
    expect(sys.agents).toHaveLength(0);
  });

  it('welcomes one Islander per house of capacity (Σ houses)', () => {
    place('home.hut', 4, 4, 'h1'); // houses: 1
    sys.announce();
    expect(state.residents).toHaveLength(1);
    expect(sys.agents).toHaveLength(1);
    expect(arrived).toEqual([ISLANDERS[0]!.id]); // move-in order: Mo first

    place('home.house', 10, 10, 'h2'); // houses: 2 → two more move in
    expect(state.residents).toHaveLength(3);
    expect(arrived).toEqual([ISLANDERS[0]!.id, ISLANDERS[1]!.id, ISLANDERS[2]!.id]);
  });

  it('is monotonic — removing a home never evicts a neighbour', () => {
    place('home.hut', 4, 4, 'h1');
    sys.announce();
    expect(state.residents).toHaveLength(1);
    island.remove('h1');
    bus.emit('item:removed', { id: 'h1', def: 'home.hut', wx: 4, wz: 4, rot: 0 });
    expect(state.residents).toHaveLength(1); // stays home — no fail states
    expect(sys.agents).toHaveLength(1);
  });

  it('caps the active roster at MAX_ISLANDERS', () => {
    let n = 0;
    for (let i = 0; i < 14; i++) {
      const wx = (i % 5) * 4;
      const wz = Math.floor(i / 5) * 4;
      place('home.hut', wx, wz, `h${i}`); // houses: 1 each → capacity 14
      n++;
    }
    expect(n).toBe(14);
    sys.announce();
    expect(state.residents).toHaveLength(MAX_ISLANDERS);
    expect(sys.agents).toHaveLength(MAX_ISLANDERS);
  });

  it('re-spawns persisted residents on announce without duplicating them', () => {
    place('home.house', 4, 4, 'h1'); // capacity 2
    sys.announce();
    expect(sys.agents).toHaveLength(2);
    const residents = [...state.residents];
    // a fresh system over the SAME persisted slice (simulates reload)
    const sys2 = new IslanderSystem(island, state, 12345);
    sys2.wire();
    sys2.announce();
    expect(state.residents).toEqual(residents); // unchanged
    expect(sys2.agents).toHaveLength(2); // spawned once, not doubled
    sys2.dispose();
  });
});

describe('IslanderSystem wander (S16)', () => {
  it('keeps every agent on a walkable cell across a long soak (never clips props/edges)', () => {
    // a hut + a tree + a fence line to weave around
    place('home.house', 8, 8, 'home'); // 2 residents
    place('nature.tree', 4, 4, 't1');
    place('nature.tree', 12, 12, 't2');
    for (let z = 0; z < 24; z++) place('decor.fence', 15, z, `f${z}`); // a wall
    sys.announce();
    expect(sys.agents.length).toBeGreaterThan(0);

    const dt = 1 / 30;
    for (let step = 0; step < 3000; step++) {
      sys.update(dt);
      for (const a of sys.agents) {
        expect(island.walkable(Math.floor(a.x), Math.floor(a.z))).toBe(true);
      }
    }
  });

  it('produces motion — agents both walk and rest over time', () => {
    place('home.hut', 8, 8, 'home');
    sys.announce();
    const a = sys.agents[0]!;
    const start = { x: a.x, z: a.z };
    let sawMoving = false;
    let moved = 0;
    const dt = 1 / 30;
    for (let step = 0; step < 600; step++) {
      sys.update(dt);
      if (a.moving) sawMoving = true;
      moved = Math.max(moved, Math.hypot(a.x - start.x, a.z - start.z));
    }
    expect(sawMoving).toBe(true); // decided to walk at least once
    expect(moved).toBeGreaterThan(0.5); // actually covered ground
  });
});

describe('roster (S16)', () => {
  it('assigns a real model to every Islander and starts with Mo', () => {
    expect(ISLANDERS.length).toBeGreaterThanOrEqual(MAX_ISLANDERS);
    expect(ISLANDERS[0]!.id).toBe('mo');
    for (const def of ISLANDERS) {
      expect(def.model).toMatch(/^npc\./);
      expect(itemDef(def.model)).toBeUndefined(); // model ids are assets, not catalog items
    }
  });
});
