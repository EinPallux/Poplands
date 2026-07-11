import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GardenSystem } from '@/sim/GardenSystem';
import { IslandModel } from '@/world/IslandModel';
import { freshGarden, type SaveGarden } from '@/core/save';
import { cropDef } from '@/content/crops';
import { bus } from '@/core/events';

const CHUNKS = [
  { cx: 0, cz: 0 },
  { cx: 1, cz: 0 },
  { cx: 0, cz: 1 },
  { cx: 1, cz: 1 },
];

let island: IslandModel;
let state: SaveGarden;
let now: number;
let sys: GardenSystem;
const offs: Array<() => void> = [];

const CARROT = 'crop.carrot';
const GROW = cropDef(CARROT)!.growMs;

beforeEach(() => {
  island = new IslandModel(CHUNKS);
  island.place('nature.garden', 4, 4, 0, 'g1'); // a Garden Patch to plant in
  state = freshGarden();
  now = 1_000_000;
  sys = new GardenSystem(island, state, () => now);
  sys.wire();
});

afterEach(() => {
  sys.dispose();
  for (const off of offs) off();
  offs.length = 0;
});

describe('GardenSystem', () => {
  it('plants → grows through stages over real time → ripens', () => {
    expect(sys.stageOf('g1')).toBe('empty');
    expect(sys.plant('g1', CARROT)).toBe(true);
    expect(sys.stageOf('g1')).toBe('sprout');

    now += GROW * 0.6; // past the halfway mark
    expect(sys.stageOf('g1')).toBe('growing');
    expect(sys.progress('g1')).toBeCloseTo(0.6, 5);

    now += GROW * 0.5; // now fully grown (and then some)
    expect(sys.stageOf('g1')).toBe('ripe');
    expect(sys.progress('g1')).toBe(1);
  });

  it('harvests only when ripe, fires the reward, clears the plot, tallies it', () => {
    sys.plant('g1', CARROT);
    let reward = 0;
    let harvestedCrop = '';
    offs.push(bus.on('garden:harvested', (e) => { reward = e.rewards.pops ?? 0; harvestedCrop = e.crop; }));

    expect(sys.harvest('g1')).toBe(false); // not ripe yet — no-op
    expect(reward).toBe(0);

    now += GROW; // ripen it
    expect(sys.harvest('g1')).toBe(true);
    expect(harvestedCrop).toBe(CARROT);
    expect(reward).toBe(cropDef(CARROT)!.reward.pops);
    expect(sys.stageOf('g1')).toBe('empty'); // plot cleared → can replant
    expect(sys.harvested).toBe(1);
    expect(state.harvested).toBe(1);
  });

  it('will not plant on a patch that is already growing something', () => {
    expect(sys.plant('g1', CARROT)).toBe(true);
    expect(sys.plant('g1', 'crop.corn')).toBe(false); // busy
    expect(state.plots['g1']!.crop).toBe(CARROT);
  });

  it('growth is offline-safe — a plot planted long ago is ripe on load', () => {
    sys.plant('g1', CARROT);
    // simulate reload after a long absence: a fresh system over the same slice + a later clock
    const later = now + GROW * 5;
    const sys2 = new GardenSystem(island, state, () => later);
    expect(sys2.stageOf('g1')).toBe('ripe');
    sys2.dispose();
  });

  it('a backward clock never makes progress negative (no penalty)', () => {
    sys.plant('g1', CARROT);
    now -= 999_999; // clock jumped backward
    expect(sys.progress('g1')).toBe(0);
    expect(sys.stageOf('g1')).toBe('sprout'); // just not grown yet — never a crash or a fail
  });

  it('tearing up the patch drops its plot', () => {
    sys.plant('g1', CARROT);
    expect(sys.view()).toHaveLength(1);
    island.remove('g1');
    bus.emit('item:removed', { id: 'g1', def: 'nature.garden', wx: 4, wz: 4, rot: 0 });
    expect(sys.view()).toHaveLength(0);
    expect(state.plots['g1']).toBeUndefined();
  });

  it('snapshot round-trips plots + harvest tally', () => {
    sys.plant('g1', CARROT);
    now += GROW;
    sys.harvest('g1');
    sys.plant('g1', 'crop.corn');
    const snap = sys.snapshot();
    const sys2 = new GardenSystem(island, snap, () => now);
    expect(sys2.harvested).toBe(1);
    expect(sys2.view()[0]!.crop).toBe('crop.corn');
    sys2.dispose();
  });
});
