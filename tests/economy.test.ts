import { describe, it, expect, beforeEach } from 'vitest';
import { computeStored, EconomySystem } from '@/sim/EconomySystem';
import { IslandModel } from '@/world/IslandModel';
import { itemDef } from '@/content/catalog';
import { popsSignal, loadWallet } from '@/core/playerStore';

const CHUNKS = [
  { cx: 0, cz: 0 },
  { cx: 1, cz: 0 },
  { cx: 0, cz: 1 },
  { cx: 1, cz: 1 },
];

// Flower Stall: 2 ●/min → cap 60. rate = 2/60000 per ms.
const STALL = 'income.stall';

describe('computeStored (the lazy accrual formula)', () => {
  const rate = 2 / 60000; // pops/ms
  const cap = 60;

  it('accrues linearly before the cap', () => {
    const s = { storedPops: 0, lastCollectAt: 0 };
    expect(computeStored(s, rate, cap, 60000)).toBeCloseTo(2, 5); // 1 minute → 2
    expect(computeStored(s, rate, cap, 300000)).toBeCloseTo(10, 5); // 5 min → 10
  });

  it('clamps to cap for huge (offline) elapsed — this is why offline is free', () => {
    const s = { storedPops: 0, lastCollectAt: 0 };
    const days = 1000 * 60 * 60 * 24 * 3;
    expect(computeStored(s, rate, cap, days)).toBe(cap);
  });

  it('never accrues on a backward / tampered clock (no penalty)', () => {
    const s = { storedPops: 15, lastCollectAt: 1_000_000 };
    expect(computeStored(s, rate, cap, 500_000)).toBe(15); // clock moved back → hold
    expect(computeStored(s, rate, cap, 1_000_000)).toBe(15); // exactly equal → hold
  });

  it('is read-only (calling it does not mutate state)', () => {
    const s = { storedPops: 5, lastCollectAt: 0 };
    computeStored(s, rate, cap, 999999);
    expect(s).toEqual({ storedPops: 5, lastCollectAt: 0 });
  });

  it('respects a nonzero starting balance under the cap', () => {
    const s = { storedPops: 55, lastCollectAt: 0 };
    expect(computeStored(s, rate, cap, 600000)).toBe(60); // 55 + 20 clamped to 60
  });
});

describe('EconomySystem', () => {
  let island: IslandModel;
  let now: number;
  let eco: EconomySystem;

  beforeEach(() => {
    island = new IslandModel(CHUNKS);
    now = 1_000_000;
    eco = new EconomySystem(island, () => now);
    loadWallet({ pops: 1000, stardust: 5 });
  });

  const placeStall = (id = 'p1') => {
    const p = island.place(STALL, 2, 2, 0, id);
    eco.onPlaced(p);
    return p;
  };

  it('charges on place and 100% refunds on remove', () => {
    const def = itemDef(STALL)!;
    const p = placeStall();
    eco.charge(def);
    expect(popsSignal.get()).toBe(900); // 1000 - 100
    // let it ripen, then remove → banks ripe pops AND refunds full cost
    now += 60000; // +1 min → +2 ripe
    eco.onRemoved(p);
    eco.refund(def);
    expect(popsSignal.get()).toBe(900 + 2 + 100); // ripe banked + refund
  });

  it('canAfford respects both wallets at the boundary', () => {
    const def = itemDef(STALL)!;
    loadWallet({ pops: 100, stardust: 0 });
    expect(eco.canAfford(def)).toBe(true); // exactly equal
    loadWallet({ pops: 99, stardust: 0 });
    expect(eco.canAfford(def)).toBe(false);
  });

  it('collect banks whole pops and carries the fraction', () => {
    placeStall();
    now += 90000; // 1.5 min → 3.0 pops exactly
    const before = popsSignal.get();
    const got = eco.collect('p1');
    expect(got).toBe(3);
    expect(popsSignal.get()).toBe(before + 3);
    // immediately after, nothing to collect
    expect(eco.collect('p1')).toBe(0);
  });

  it('preserves accrual across a move (accrual keyed by id, not re-seeded)', () => {
    const p = placeStall();
    now += 60000; // +2 ripe
    // simulate move: island.remove + re-place same id, NO economy lifecycle calls
    island.remove(p.id);
    island.place(STALL, 5, 5, 0, p.id);
    // ripe pops survived the move
    expect(eco.ripeAmount(p.id)).toBeCloseTo(2, 5);
  });

  it('offline resolution adds no pops but marks ripe (self-correcting formula)', () => {
    placeStall();
    // hydrate from a save collected an hour ago (> 30 min cap time) → already capped
    eco.hydrate(
      { accrual: [{ id: 'p1', storedPops: 0, lastCollectAt: now - 3_600_000 }] },
      island.allPlacements(),
    );
    const walletBefore = popsSignal.get();
    eco.resolveOffline(now);
    expect(popsSignal.get()).toBe(walletBefore); // resolveOffline never credits
    expect(eco.ripeFraction('p1')).toBe(1); // but it is fully ripe from offline time
  });

  it('snapshot round-trips accrual state', () => {
    placeStall();
    now += 30000;
    eco.collect('p1'); // leaves a fractional carry + updated lastCollectAt
    const snap = eco.snapshot();
    expect(snap.accrual).toHaveLength(1);
    expect(snap.accrual[0]!.id).toBe('p1');
    expect(snap.accrual[0]!.lastCollectAt).toBe(now);
  });

  it('non-income items never accrue', () => {
    const p = island.place('nature.tree', 1, 1, 0, 'p9');
    eco.onPlaced(p);
    expect(eco.ripeAmount('p9')).toBe(0);
    expect(eco.collect('p9')).toBe(0);
  });
});
