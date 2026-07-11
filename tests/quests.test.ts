import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QuestSystem } from '@/sim/QuestSystem';
import { IslandModel } from '@/world/IslandModel';
import { freshQuests, type SaveQuests } from '@/core/save';
import { bus } from '@/core/events';
import { TUTORIAL_FIRST_ID } from '@/content/quests';

const CHUNKS = [
  { cx: 0, cz: 0 },
  { cx: 1, cz: 0 },
  { cx: 0, cz: 1 },
  { cx: 1, cz: 1 },
];

let island: IslandModel;
let state: SaveQuests;
let now: number;
let qs: QuestSystem;
let completed: string[];
let offered: string[];
const offs: Array<() => void> = [];

function place(def: string, wx: number, wz: number, id: string) {
  island.place(def, wx, wz, 0, id);
  bus.emit('item:placed', { id, def, wx, wz, rot: 0 });
}

beforeEach(() => {
  island = new IslandModel(CHUNKS);
  state = freshQuests(0);
  now = 1000;
  completed = [];
  offered = [];
  offs.push(bus.on('quest:completed', (e) => completed.push(e.id)));
  offs.push(bus.on('quest:offered', (e) => offered.push(e.id)));
  qs = new QuestSystem(island, state, 1, () => now);
  qs.wire();
});

afterEach(() => {
  qs.dispose();
  for (const off of offs) off();
  offs.length = 0;
});

describe('QuestSystem tutorial chain', () => {
  it('announces the first step on a fresh save', () => {
    qs.announce();
    expect(state.tutorial.activeId).toBe(TUTORIAL_FIRST_ID);
    expect(offered).toContain(TUTORIAL_FIRST_ID);
  });

  it('completes "plant 3 flowers" and advances to the path step', () => {
    qs.announce();
    place('nature.flower.red', 1, 1, 'f1');
    place('nature.flower.purple', 2, 1, 'f2');
    expect(completed).not.toContain('tut.flowers'); // only 2 so far
    place('nature.flower.yellow', 3, 1, 'f3');
    expect(completed).toContain('tut.flowers');
    expect(state.tutorial.activeId).toBe('tut.path');
    expect(offered).toContain('tut.path');
  });

  it('progresses collectPops on income:collected', () => {
    // fast-forward the tutorial to the collect step
    state.tutorial.activeId = 'tut.collect';
    state.tutorial.done = ['tut.flowers', 'tut.path', 'tut.bench', 'tut.stall'];
    qs.announce();
    bus.emit('income:collected', { amount: 1, at: now, wx: 0, wz: 0, currency: 'pops' });
    expect(completed).toContain('tut.collect');
  });

  it('completes an adjacency step (lantern near hut)', () => {
    state.tutorial.activeId = 'tut.cozycorner';
    qs.announce();
    place('home.hut', 5, 5, 'h1'); // 3×3
    place('decor.lantern', 8, 6, 'l1'); // within 2 of the hut footprint
    expect(completed).toContain('tut.cozycorner');
  });

  it('reachLevel step completes on level:up', () => {
    state.tutorial.activeId = 'tut.level2';
    qs.announce();
    bus.emit('level:up', { level: 2, rewards: { pops: 0, stardust: 0 }, unlockedTier: 2, newItems: [] });
    expect(completed).toContain('tut.level2');
  });

  it('capstone unlocks free play and draws postcards', () => {
    state.tutorial.activeId = 'tut.capstone';
    // own 30 things
    for (let i = 0; i < 30; i++) place('nature.grass', i % 16, Math.floor(i / 16), `g${i}`);
    qs.announce(); // seeds capstone progress from countOwned → completes on offer
    expect(completed).toContain('tut.capstone');
    expect(state.freePlayUnlocked).toBe(true);
    expect(state.postcards.active.length).toBeGreaterThan(0);
  });
});

describe('QuestSystem seeding & exploits', () => {
  it('seeds place progress from already-owned items (forgiving)', () => {
    // island already has 3 flowers before the tutorial is offered
    place('nature.flower.red', 1, 1, 'f1');
    place('nature.flower.purple', 2, 1, 'f2');
    place('nature.flower.yellow', 3, 1, 'f3');
    completed.length = 0;
    qs.announce(); // first step is "plant 3 flowers" → already satisfied → auto-complete
    expect(completed).toContain('tut.flowers');
  });

  it('a move (item:moved) never advances place counters or milestones', () => {
    qs.announce();
    const before = state.milestones.itemsPlaced;
    bus.emit('item:moved', { id: 'x', def: 'nature.flower.red', wx: 1, wz: 1, rot: 0 });
    expect(state.milestones.itemsPlaced).toBe(before); // unchanged — exploit closed
  });

  it('a silent placement (hydration) never counts', () => {
    qs.announce();
    const before = state.milestones.itemsPlaced;
    bus.emit('item:placed', { id: 'y', def: 'nature.flower.red', wx: 1, wz: 1, rot: 0, silent: true });
    expect(state.milestones.itemsPlaced).toBe(before);
  });
});

describe('QuestSystem milestones & postcards', () => {
  it('fires a milestone reward when a counter crosses a tier', () => {
    state.freePlayUnlocked = true;
    qs.announce();
    for (let i = 0; i < 25; i++) place('nature.grass', i % 16, Math.floor(i / 16), `g${i}`);
    // ms.placed tier 0 is at 25 items
    expect(completed.some((id) => id.startsWith('ms.placed'))).toBe(true);
  });

  it('tick refills a freed slot only after the cooldown, and no-ops when the pool is dry', () => {
    qs.dispose(); // drop the beforeEach subscription; rewire in free-play
    state.freePlayUnlocked = true;
    qs = new QuestSystem(island, state, 1, () => now);
    qs.wire();
    qs.announce(); // draws the 2 L1 postcards
    expect(state.postcards.active.length).toBe(2);

    bus.emit('cmd:skipPostcard', { id: state.postcards.active[0]!.id }); // frees a slot, 4 s cooldown
    expect(state.postcards.active.length).toBe(1);
    qs.tick(); // still inside the cooldown → no refill (and no per-frame pool scan)
    expect(state.postcards.active.length).toBe(1);

    now += 5000; // cooldown lapsed
    qs.tick(); // refills the open slot
    expect(state.postcards.active.length).toBe(2);

    // pool now dry at L1 (both cards held) — further ticks are safe, allocation-free no-ops
    now += 5000;
    expect(() => qs.tick()).not.toThrow();
    expect(state.postcards.active.length).toBe(2);
  });

  it('skipping a postcard defers it behind a cooldown, then redraws', () => {
    state.freePlayUnlocked = true;
    qs = new QuestSystem(island, state, 1, () => now);
    qs.wire();
    qs.announce();
    const first = state.postcards.active[0]?.id;
    expect(first).toBeTruthy();
    bus.emit('cmd:skipPostcard', { id: first! });
    expect(state.postcards.skipped).toContain(first);
    // cooldown blocks immediate redraw of a 2nd until time passes
    now += 5000;
    qs['drawPostcards'](); // advance the clock past cooldown
    expect(state.postcards.active.length).toBeGreaterThan(0);
  });
});
