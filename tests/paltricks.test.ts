import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PalSystem } from '@/sim/PalSystem';
import { IslandModel } from '@/world/IslandModel';
import { freshIslanders, type SaveIslanders } from '@/core/save';
import { bus } from '@/core/events';

const CHUNKS = [
  { cx: 0, cz: 0 },
  { cx: 1, cz: 0 },
  { cx: 0, cz: 1 },
  { cx: 1, cz: 1 },
];

describe('Pal tricks (post-1.0)', () => {
  let island: IslandModel;
  let state: SaveIslanders;
  let sys: PalSystem;
  let clips: Array<{ id: string; clip: string }>;
  let learned: Array<{ id: string }>;
  const offs: Array<() => void> = [];

  beforeEach(() => {
    island = new IslandModel(CHUNKS);
    state = freshIslanders();
    state.pals = ['cat']; // pre-seed one Pal so announce() spawns it
    clips = [];
    learned = [];
    offs.push(bus.on('agent:playClip', (e) => clips.push({ id: e.id, clip: e.clip })));
    offs.push(bus.on('pal:learnedTrick', (e) => learned.push({ id: e.id })));
    sys = new PalSystem(island, state, 999);
    sys.wire();
    sys.announce();
  });

  afterEach(() => {
    sys.dispose();
    for (const off of offs) off();
    offs.length = 0;
  });

  const pet = (id: string): void => bus.emit('cmd:clickPal', { id });

  it('counts pets and learns a trick after enough of them', () => {
    expect(sys.petCount('cat')).toBe(0);
    pet('cat');
    pet('cat');
    expect(sys.tricks()).toHaveLength(0); // not yet
    expect(learned).toHaveLength(0);
    pet('cat'); // the third pet
    expect(sys.petCount('cat')).toBe(3);
    expect(sys.tricks()).toEqual(['cat']);
    expect(learned).toEqual([{ id: 'cat' }]); // fired exactly once
  });

  it('only announces the trick once, then keeps performing it', () => {
    pet('cat');
    pet('cat');
    pet('cat'); // learns
    pet('cat');
    pet('cat'); // two more pets
    expect(learned).toHaveLength(1); // announced only on the crossing
    // a learned Pal now shows its trick (a dance) on every pet
    const danceClips = clips.filter((c) => c.id === 'cat' && c.clip === 'dance');
    expect(danceClips.length).toBeGreaterThanOrEqual(3); // pets 3,4,5 → dance
  });

  it('plays the happy wiggle (not the trick) before it is learned', () => {
    pet('cat'); // pet 1 — not learned yet
    const first = clips.filter((c) => c.id === 'cat');
    expect(first.some((c) => c.clip === 'gesture-positive')).toBe(true);
    expect(first.some((c) => c.clip === 'dance')).toBe(false);
  });

  it('persists the pet count in the save slice (survives a reload)', () => {
    pet('cat');
    pet('cat');
    pet('cat');
    expect(state.palPets['cat']).toBe(3); // written into the persisted slice
    // a fresh system over the same saved state remembers the trick
    const reloaded = new PalSystem(island, state, 999);
    reloaded.announce();
    expect(reloaded.tricks()).toEqual(['cat']);
    reloaded.dispose();
  });
});
