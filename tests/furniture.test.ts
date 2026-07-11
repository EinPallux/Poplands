import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IslanderSystem } from '@/sim/IslanderSystem';
import { IslandModel } from '@/world/IslandModel';
import { freshIslanders, type SaveIslanders } from '@/core/save';
import { bus } from '@/core/events';

/** 3×3 chunk island (24×24 blocks) — roomy for homes + furniture to weave around. */
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
let clips: Array<{ id: string; clip: string; hold?: boolean }>;
let cleared: string[];
const offs: Array<() => void> = [];

function place(def: string, wx: number, wz: number, id: string) {
  island.place(def, wx, wz, 0, id);
  bus.emit('item:placed', { id, def, wx, wz, rot: 0 });
}

beforeEach(() => {
  island = new IslandModel(CHUNKS);
  state = freshIslanders();
  clips = [];
  cleared = [];
  offs.push(bus.on('agent:playClip', (e) => clips.push(e)));
  offs.push(bus.on('agent:clearClip', (e) => cleared.push(e.id)));
  sys = new IslanderSystem(island, state, 12345);
  sys.wire();
});

afterEach(() => {
  sys.dispose();
  for (const off of offs) off();
  offs.length = 0;
});

describe('IslanderSystem furniture — sit (post-1.0)', () => {
  it('a neighbour perches on a bench: sit pose held + seat lift, on walkable ground', () => {
    place('home.house', 10, 10, 'home'); // 2 residents
    place('decor.bench', 5, 5, 'bench');
    sys.announce();

    const seated = sys.debugSitNow('bench');
    expect(seated).not.toBeNull();
    expect(seated!.kind).toBe('sit');

    const usage = sys.debugUsage();
    expect(usage).toHaveLength(1);
    expect(usage[0]!.using).toBe(true);
    expect(usage[0]!.pid).toBe('bench');
    expect(usage[0]!.lift).toBeGreaterThan(0); // lifted onto the seat

    // a held sit clip was emitted for the renderer
    const sit = clips.find((c) => c.id === seated!.id && c.clip === 'sit');
    expect(sit).toBeTruthy();
    expect(sit!.hold).toBe(true);

    // the sim keeps the seated agent on its walkable approach cell (render-only lean)
    const a = sys.agents.find((x) => x.id === seated!.id)!;
    expect(island.walkable(Math.floor(a.x), Math.floor(a.z))).toBe(true);
  });

  it('standing up releases the seat + clears the held pose, then wanders again', () => {
    place('home.hut', 10, 10, 'home');
    place('decor.bench', 5, 5, 'bench');
    sys.announce();
    const seated = sys.debugSitNow('bench')!;

    expect(sys.debugEndUse(seated.id)).toBe(true);
    expect(cleared).toContain(seated.id); // the sit hold was released
    expect(sys.debugUsage()).toHaveLength(0); // no longer using

    // the seat is free again — someone can claim it
    place('home.house', 2, 2, 'home2'); // more residents to try
    const again = sys.debugSitNow('bench');
    expect(again).not.toBeNull();
  });
});

describe('IslanderSystem furniture — gather (post-1.0)', () => {
  it('a neighbour gathers at a campfire: no lift, glances about with emotes', () => {
    place('home.hut', 10, 10, 'home');
    place('decor.campfire', 6, 6, 'fire');
    sys.announce();

    const g = sys.debugSitNow('fire');
    expect(g!.kind).toBe('gather');
    const usage = sys.debugUsage();
    expect(usage[0]!.lift).toBe(0); // stands beside it, not lifted
    expect(clips.some((c) => c.clip === 'sit')).toBe(false); // never sits at a fire

    // tick through the visit → at least one look/emote clip fires (non-held)
    for (let i = 0; i < 300; i++) sys.update(1 / 30);
    const emotes = clips.filter((c) => c.id === g!.id && c.clip !== 'sit' && !c.hold);
    expect(emotes.length).toBeGreaterThan(0);
  });
});

describe('IslanderSystem furniture — occupancy + removal', () => {
  it('only one neighbour claims a given piece at a time', () => {
    place('home.house', 10, 10, 'home'); // 2 residents
    place('decor.bench', 5, 5, 'bench');
    sys.announce();

    expect(sys.debugSitNow('bench')).not.toBeNull(); // first claims it
    expect(sys.debugSitNow('bench')).toBeNull(); // already taken — no double-seating
    expect(sys.debugUsage()).toHaveLength(1);
  });

  it('removing furniture mid-use gets the neighbour up gracefully', () => {
    place('home.hut', 10, 10, 'home');
    place('decor.bench', 5, 5, 'bench');
    sys.announce();
    const seated = sys.debugSitNow('bench')!;

    island.remove('bench');
    bus.emit('item:removed', { id: 'bench', def: 'decor.bench', wx: 5, wz: 5, rot: 0 });

    expect(sys.debugUsage()).toHaveLength(0); // no longer stuck on the gone bench
    expect(cleared).toContain(seated.id); // pose cleared
    const a = sys.agents.find((x) => x.id === seated.id)!;
    expect(island.walkable(Math.floor(a.x), Math.floor(a.z))).toBe(true);
    // keeps simulating without error
    for (let i = 0; i < 60; i++) sys.update(1 / 30);
  });
});

describe('IslanderSystem furniture — organic + invariant soak', () => {
  it('over a soak a neighbour naturally seeks furniture, always on walkable ground', () => {
    place('home.house', 8, 8, 'home'); // 2 residents
    place('decor.bench', 4, 12, 'bench');
    place('decor.campfire', 14, 6, 'fire');
    place('nature.tree', 10, 4, 't1'); // an obstacle to weave around
    sys.announce();

    let usedFurniture = false;
    const dt = 1 / 30;
    for (let step = 0; step < 6000; step++) {
      sys.update(dt);
      if (sys.debugUsage().length > 0) usedFurniture = true;
      for (const a of sys.agents) {
        // the core invariant: a seated/gathering agent still stands on a walkable cell
        expect(island.walkable(Math.floor(a.x), Math.floor(a.z))).toBe(true);
      }
    }
    expect(usedFurniture).toBe(true); // the wander AI chose to use furniture at least once
  });
});
