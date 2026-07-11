import { describe, it, expect, beforeEach } from 'vitest';
import { FishingSystem } from '@/sim/FishingSystem';
import { rollFish, FISH, fishDef } from '@/content/fish';
import { IslandModel } from '@/world/IslandModel';
import { bus } from '@/core/events';
import { freshFishing } from '@/core/save';

const CHUNKS = [
  { cx: 0, cz: 0 },
  { cx: 1, cz: 0 },
  { cx: 0, cz: 1 },
  { cx: 1, cz: 1 },
];
const POND = 'nature.fishing-pond';
const FIRST = FISH[0]!.id;
const LAST = FISH[FISH.length - 1]!.id;

/** rng that yields queued values then repeats the last — deterministic control. */
function makeRng(seq: number[]): () => number {
  let i = 0;
  return () => (i < seq.length ? seq[i++]! : (seq[seq.length - 1] ?? 0));
}

describe('rollFish (weighted catch table)', () => {
  it('maps r=0 to the first species and r→1 to the last', () => {
    expect(rollFish(0).id).toBe(FIRST);
    expect(rollFish(0.99999).id).toBe(LAST);
  });
  it('returns a defined species across the whole range', () => {
    for (let r = 0; r < 1; r += 0.01) expect(fishDef(rollFish(r).id)).toBeDefined();
  });
});

describe('FishingSystem', () => {
  let island: IslandModel;
  beforeEach(() => {
    island = new IslandModel(CHUNKS);
    island.place(POND, 2, 2, 0, 'pond1');
  });

  it('cast → nibble → catch: emits events, rewards, and latches the collection', () => {
    const sys = new FishingSystem(island, freshFishing(), 1, makeRng([0, 0])); // wait→MIN, roll→first
    const seen: string[] = [];
    let caughtId = '';
    let isNew = false;
    let pops = 0;
    const offs = [
      bus.on('fishing:cast', () => seen.push('cast')),
      bus.on('fishing:nibble', () => seen.push('nibble')),
      bus.on('fishing:caught', (e) => {
        caughtId = e.fishId;
        isNew = e.isNew;
        pops = e.rewards.pops ?? 0;
      }),
    ];

    sys.castLine('pond1');
    expect(seen).toContain('cast');
    sys.tick(2.0); // past WAIT_MIN (1.6) → nibble
    expect(seen).toContain('nibble');
    sys.castLine('pond1'); // reel within the window
    expect(caughtId).toBe(FIRST);
    expect(isNew).toBe(true);
    expect(pops).toBeGreaterThan(0);

    const col = sys.collection();
    expect(col.total).toBe(1);
    expect(col.caught[FIRST]).toBe(1);
    offs.forEach((o) => o());
  });

  it('a repeat catch is not "new" and increments the count', () => {
    const sys = new FishingSystem(island, freshFishing(), 1, makeRng([0, 0]));
    let lastNew = true;
    const off = bus.on('fishing:caught', (e) => (lastNew = e.isNew));
    for (let i = 0; i < 2; i++) {
      sys.castLine('pond1');
      sys.tick(5);
      sys.castLine('pond1');
    }
    expect(lastNew).toBe(false);
    expect(sys.collection().caught[FIRST]).toBe(2);
    expect(sys.collection().total).toBe(2);
    off();
  });

  it('missing the reel window is gentle — no catch, back to idle, recastable', () => {
    const sys = new FishingSystem(island, freshFishing(), 1, makeRng([0]));
    let missed = false;
    let caught = false;
    const o1 = bus.on('fishing:missed', () => (missed = true));
    const o2 = bus.on('fishing:caught', () => (caught = true));
    sys.castLine('pond1');
    sys.tick(2.0); // → nibble
    sys.tick(3.5); // past the 3 s window → it got away
    expect(missed).toBe(true);
    expect(caught).toBe(false);
    let recast = false;
    const o3 = bus.on('fishing:cast', () => (recast = true));
    sys.castLine('pond1'); // idle again → a fresh cast works
    expect(recast).toBe(true);
    o1();
    o2();
    o3();
  });

  it('ignores taps on a non-pond placement', () => {
    island.place('nature.tree', 6, 6, 0, 'tree1');
    const sys = new FishingSystem(island, freshFishing(), 1, makeRng([0, 0]));
    let cast = false;
    const off = bus.on('fishing:cast', () => (cast = true));
    sys.castLine('tree1');
    expect(cast).toBe(false);
    off();
  });

  it('snapshot round-trips the collection', () => {
    const sys = new FishingSystem(island, freshFishing(), 1, makeRng([0, 0]));
    sys.castLine('pond1');
    sys.tick(5);
    sys.castLine('pond1');
    const snap = sys.snapshot();
    const sys2 = new FishingSystem(island, snap, 1, makeRng([0, 0]));
    expect(sys2.collection().total).toBe(1);
    expect(sys2.snapshot()).toEqual(snap);
  });

  it('a controlled rng reaches the legendary tail (Stardust reward)', () => {
    const sys = new FishingSystem(island, freshFishing(), 1, makeRng([0.5, 0.999]));
    let caughtId = '';
    let stardust = 0;
    const off = bus.on('fishing:caught', (e) => {
      caughtId = e.fishId;
      stardust = e.rewards.stardust ?? 0;
    });
    sys.castLine('pond1');
    sys.tick(5);
    sys.castLine('pond1');
    expect(caughtId).toBe(LAST);
    expect(stardust).toBeGreaterThan(0);
    off();
  });

  it('a pond removed mid-cast cancels the line', () => {
    const sys = new FishingSystem(island, freshFishing(), 1, makeRng([0, 0]));
    sys.wire(); // subscribes to item:removed
    let cast = false;
    const off = bus.on('fishing:cast', () => (cast = true));
    sys.castLine('pond1');
    expect(cast).toBe(true);
    bus.emit('item:removed', { id: 'pond1', def: POND, wx: 2, wz: 2, rot: 0 });
    // line cancelled → a nibble should NOT fire even after plenty of time
    let nibble = false;
    const off2 = bus.on('fishing:nibble', () => (nibble = true));
    sys.tick(10);
    expect(nibble).toBe(false);
    off();
    off2();
    sys.dispose();
  });
});
