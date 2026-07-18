import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RequestSystem } from '@/sim/RequestSystem';
import { WISH_INTERVAL_S } from '@/content/requests';
import { bus } from '@/core/events';

describe('RequestSystem (Islander wishes, post-1.0)', () => {
  let rs: RequestSystem;
  let positions: Map<string, { x: number; z: number } | null>;
  let fulfilled: Array<{ id: string; rewards: { pops?: number; xp?: number } }>;
  const offs: Array<() => void> = [];

  beforeEach(() => {
    positions = new Map([
      ['mo', { x: 5, z: 5 }],
      ['pia', { x: 24, z: 24 }],
    ]);
    rs = new RequestSystem(
      () => ['mo', 'pia'],
      (id) => positions.get(id) ?? null,
      123,
    );
    rs.wire();
    fulfilled = [];
    offs.push(bus.on('request:fulfilled', (e) => fulfilled.push({ id: e.id, rewards: e.rewards })));
  });

  afterEach(() => {
    rs.dispose();
    for (const off of offs) off();
    offs.length = 0;
  });

  it('rolls a wish for a present, wishless resident', () => {
    const w = rs.debugNewWish('mo', 'nature');
    expect(w).toEqual({ id: 'mo', category: 'nature' });
    expect(rs.debugWishes()).toEqual([{ id: 'mo', category: 'nature' }]);
  });

  it('grants a wish when a matching thing is placed nearby → reward event', () => {
    rs.debugNewWish('mo', 'nature');
    // a tree one block from Mo (centre 4.5,4.5 vs Mo at 5,5 ≈ 0.7 blocks)
    bus.emit('item:placed', { id: 'p1', def: 'nature.tree', wx: 4, wz: 4, rot: 0 });
    expect(fulfilled).toHaveLength(1);
    expect(fulfilled[0]!.id).toBe('mo');
    expect(fulfilled[0]!.rewards.pops).toBeGreaterThan(0);
    expect(fulfilled[0]!.rewards.xp).toBeGreaterThan(0);
    expect(rs.debugWishes()).toHaveLength(0); // the wish cleared
  });

  it('ignores a wrong-category placement', () => {
    rs.debugNewWish('mo', 'nature');
    bus.emit('item:placed', { id: 'p1', def: 'income.stall', wx: 4, wz: 4, rot: 0 });
    expect(fulfilled).toHaveLength(0);
    expect(rs.debugWishes()).toHaveLength(1); // still wishing
  });

  it('ignores a matching placement that is too far away', () => {
    rs.debugNewWish('mo', 'nature'); // Mo is at (5,5)
    bus.emit('item:placed', { id: 'p1', def: 'nature.tree', wx: 24, wz: 24, rot: 0 }); // way over by Pia
    expect(fulfilled).toHaveLength(0);
    expect(rs.debugWishes()).toHaveLength(1);
  });

  it('spawns a wish on its own after the interval elapses', () => {
    expect(rs.debugWishes()).toHaveLength(0);
    rs.update(WISH_INTERVAL_S + 1); // fast-forward past the timer
    expect(rs.debugWishes().length).toBeGreaterThanOrEqual(1);
  });

  it('never wishes for an absent (unspawned) resident', () => {
    positions.set('mo', null);
    positions.set('pia', null); // nobody is actually on the island
    rs.update(WISH_INTERVAL_S + 1);
    expect(rs.debugWishes()).toHaveLength(0);
  });
});
