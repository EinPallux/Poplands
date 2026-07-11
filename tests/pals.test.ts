import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PalSystem } from '@/sim/PalSystem';
import { IslandModel } from '@/world/IslandModel';
import { freshIslanders, type SaveIslanders } from '@/core/save';
import { PALS, MAX_PALS } from '@/content/pals';
import { bus } from '@/core/events';

const CHUNKS = [
  { cx: 0, cz: 0 },
  { cx: 1, cz: 0 },
  { cx: 0, cz: 1 },
  { cx: 1, cz: 1 },
];

let island: IslandModel;
let state: SaveIslanders;
let sys: PalSystem;
const offs: Array<() => void> = [];

function place(def: string, wx: number, wz: number, id: string) {
  island.place(def, wx, wz, 0, id);
  bus.emit('item:placed', { id, def, wx, wz, rot: 0 });
}

beforeEach(() => {
  island = new IslandModel(CHUNKS);
  state = freshIslanders();
  sys = new PalSystem(island, state, 999);
  sys.wire();
});

afterEach(() => {
  sys.dispose();
  for (const off of offs) off();
  offs.length = 0;
});

describe('PalSystem (S18)', () => {
  it('draws a Pal for every 8 nature items, capped at MAX_PALS', () => {
    sys.announce();
    expect(state.pals).toHaveLength(0); // no garden yet

    for (let i = 0; i < 8; i++) place('nature.flower.red', i, 0, `f${i}`);
    expect(state.pals).toHaveLength(1); // first garden → first Pal
    expect(state.pals[0]).toBe(PALS[0]!.id); // adoption order: cat first
    expect(sys.agents).toHaveLength(1);

    for (let i = 0; i < 200; i++) place('nature.grass', i % 16, Math.floor(i / 16) + 1, `g${i}`);
    expect(state.pals.length).toBe(MAX_PALS); // capped
    expect(sys.agents).toHaveLength(MAX_PALS);
  });

  it('is monotonic — removing nature never sends a Pal away', () => {
    for (let i = 0; i < 8; i++) place('nature.flower.red', i, 0, `f${i}`);
    sys.announce();
    expect(state.pals).toHaveLength(1);
    island.remove('f0');
    bus.emit('item:removed', { id: 'f0', def: 'nature.flower.red', wx: 0, wz: 0, rot: 0 });
    expect(state.pals).toHaveLength(1);
  });

  it('petting a Pal makes it react and pause', () => {
    for (let i = 0; i < 8; i++) place('nature.flower.red', i, 0, `f${i}`);
    sys.announce();
    const p = sys.agents[0]!;
    const petted: string[] = [];
    const clips: Array<{ id: string; clip: string }> = [];
    offs.push(bus.on('pal:petted', (e) => petted.push(e.id)));
    offs.push(bus.on('agent:playClip', (e) => clips.push(e)));

    bus.emit('cmd:clickPal', { id: p.id });
    expect(petted).toEqual([p.id]);
    expect(clips.some((c) => c.id === p.id && c.clip === 'gesture-positive')).toBe(true);

    const from = { x: p.x, z: p.z };
    for (let i = 0; i < 20; i++) sys.update(1 / 30);
    expect(Math.hypot(p.x - from.x, p.z - from.z)).toBe(0); // paused while petted
  });

  it('keeps Pals on walkable ground across a soak', () => {
    for (let i = 0; i < 24; i++) place('nature.grass', i % 16, Math.floor(i / 16), `g${i}`);
    place('home.hut', 5, 8, 'h1');
    sys.announce();
    expect(sys.agents.length).toBeGreaterThan(0);
    for (let step = 0; step < 2000; step++) {
      sys.update(1 / 30);
      for (const p of sys.agents) {
        expect(island.walkable(Math.floor(p.x), Math.floor(p.z))).toBe(true);
      }
    }
  });
});
