import { describe, it, expect } from 'vitest';
import { MuseumSystem } from '@/sim/MuseumSystem';
import { FISH } from '@/content/fish';
import { bus } from '@/core/events';
import { freshMuseum } from '@/core/save';

const A = FISH[0]!.id;
const B = FISH[1]!.id;
const LAST = FISH[FISH.length - 1]!.id;

describe('MuseumSystem', () => {
  it('donates a caught species once — rewarded and put on display', () => {
    const state = freshMuseum();
    const sys = new MuseumSystem(state, () => [A]); // only species A is caught
    let donatedSpecies = '';
    let pops = 0;
    const off = bus.on('museum:donated', (e) => {
      donatedSpecies = e.species;
      pops = e.rewards.pops ?? 0;
    });
    expect(sys.canDonate(A)).toBe(true);
    expect(sys.donate(A)).toBe(true);
    expect(donatedSpecies).toBe(A);
    expect(pops).toBeGreaterThan(0);
    expect(state.donated).toContain(A);
    // a second donation of the same species is a no-op
    expect(sys.canDonate(A)).toBe(false);
    expect(sys.donate(A)).toBe(false);
    off();
  });

  it('cannot donate a species that has not been caught', () => {
    const sys = new MuseumSystem(freshMuseum(), () => [A]); // B not caught
    let fired = false;
    const off = bus.on('museum:donated', () => (fired = true));
    expect(sys.canDonate(B)).toBe(false);
    expect(sys.donate(B)).toBe(false);
    expect(fired).toBe(false);
    off();
  });

  it('view reports display / catchable / locked per fish', () => {
    const sys = new MuseumSystem(freshMuseum(), () => [A, B]); // A + B caught
    sys.donate(A);
    const v = sys.view();
    expect(v.total).toBe(FISH.length);
    expect(v.donatedCount).toBe(1);
    expect(v.fish.find((f) => f.id === A)!.state).toBe('display');
    expect(v.fish.find((f) => f.id === B)!.state).toBe('catchable');
    expect(v.fish.find((f) => f.id === LAST)!.state).toBe('locked');
  });

  it('completes the Fish Hall when every species is on display', () => {
    const all = FISH.map((f) => f.id);
    const sys = new MuseumSystem(freshMuseum(), () => all); // everything caught
    let completed = false;
    const off = bus.on('museum:completed', () => (completed = true));
    for (const id of all) sys.donate(id);
    expect(completed).toBe(true);
    expect(sys.view().donatedCount).toBe(FISH.length);
    off();
  });

  it('snapshot round-trips the donated set', () => {
    const sys = new MuseumSystem(freshMuseum(), () => [A]);
    sys.donate(A);
    const snap = sys.snapshot();
    const sys2 = new MuseumSystem(snap, () => [A]);
    expect(sys2.view().donatedCount).toBe(1);
    expect(sys2.snapshot()).toEqual(snap);
  });
});
