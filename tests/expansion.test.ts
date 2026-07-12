import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chunkPrice, canExpand, CHUNK_SOFT_CAP, STARTER_CHUNKS } from '@/content/expansion';
import { IslandModel } from '@/world/IslandModel';
import { ExpansionSystem } from '@/sim/ExpansionSystem';
import { EconomySystem } from '@/sim/EconomySystem';
import { loadWallet, popsSignal, stardustSignal } from '@/core/playerStore';
import { bus } from '@/core/events';

const STARTER = [
  { cx: 0, cz: 0 },
  { cx: 1, cz: 0 },
  { cx: 0, cz: 1 },
  { cx: 1, cz: 1 },
];

describe('chunkPrice (S7 ladder, CONTENT §6.2)', () => {
  it('matches the published anchors and Stardust steps', () => {
    expect(chunkPrice(4)).toEqual({ pops: 250, stardust: 2 }); // chunk 5, k=1
    expect(chunkPrice(5).pops).toBe(330); // k=2
    expect(chunkPrice(6).pops).toBe(440); // k=3
    expect(chunkPrice(7).stardust).toBe(3); // k=4 → 2 + ⌊4/4⌋
    expect(chunkPrice(11).stardust).toBe(4); // k=8 → 2 + 2
    expect(chunkPrice(15).stardust).toBe(5); // k=12 → 2 + 3
  });

  it('is strictly increasing in Pops across the whole ladder', () => {
    for (let n = STARTER_CHUNKS; n < CHUNK_SOFT_CAP - 1; n++) {
      expect(chunkPrice(n + 1).pops).toBeGreaterThan(chunkPrice(n).pops);
    }
  });

  it('themed chunks cost +25% (dormant path, v0.6)', () => {
    const base = chunkPrice(4);
    const themed = chunkPrice(4, true);
    expect(themed.pops).toBe(Math.round((base.pops * 1.25) / 10) * 10);
    expect(themed.stardust).toBeGreaterThanOrEqual(base.stardust);
  });

  it('canExpand stops at the 36-chunk soft cap', () => {
    expect(canExpand(35)).toBe(true);
    expect(canExpand(36)).toBe(false);
  });
});

describe('IslandModel expansion (S7)', () => {
  it('addChunk grows the lattice and is idempotent', () => {
    const m = new IslandModel(STARTER);
    expect(m.chunkCount).toBe(4);
    expect(m.addChunk(2, 0)).toBe(true);
    expect(m.chunkCount).toBe(5);
    expect(m.addChunk(2, 0)).toBe(false); // already owned
    expect(m.hasChunk(2, 0)).toBe(true);
  });

  it('expandableSlots are exactly the edge-adjacent unowned cells', () => {
    const m = new IslandModel(STARTER); // 2×2 chunk block
    const slots = m.expandableSlots();
    expect(slots).toHaveLength(8); // perimeter of a 2×2 block
    for (const s of slots) {
      expect(m.hasChunk(s.cx, s.cz)).toBe(false); // unowned
      const connected = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dz]) => m.hasChunk(s.cx + dx!, s.cz + dz!));
      expect(connected).toBe(true); // lattice-connected (no detached slots)
    }
  });
});

describe('ExpansionSystem (S8 buy flow)', () => {
  let island: IslandModel;
  let eco: EconomySystem;
  let exp: ExpansionSystem;
  let unlocked: Array<{ cx: number; cz: number; index: number }>;
  let denied: string[];
  const offs: Array<() => void> = [];

  beforeEach(() => {
    island = new IslandModel(STARTER);
    eco = new EconomySystem(island, () => 1000);
    exp = new ExpansionSystem(island, eco, 12345);
    exp.wire();
    unlocked = [];
    denied = [];
    offs.push(bus.on('chunk:unlocked', (e) => unlocked.push(e)));
    offs.push(bus.on('purchase:denied', (e) => denied.push(e.reason)));
    loadWallet({ pops: 10000, stardust: 20 });
  });

  afterEach(() => {
    exp.dispose();
    for (const off of offs) off();
    offs.length = 0;
  });

  it('offers a priced survey on EVERY free edge (all four sides, user 2026-07-12)', () => {
    const s = exp.surveys();
    // no longer capped at 3 — a player can call a chunk on any frontier slot
    expect(s).toHaveLength(island.expandableSlots().length); // 8 around a 2×2 block
    expect(s.length).toBe(8);
    for (const slot of s) {
      expect(slot.pops).toBe(250);
      expect(slot.stardust).toBe(2);
      expect(island.hasChunk(slot.cx, slot.cz)).toBe(false);
    }
    // every frontier slot is present (parity with expandableSlots)
    for (const c of island.expandableSlots()) {
      expect(s.some((sl) => sl.cx === c.cx && sl.cz === c.cz)).toBe(true);
    }
  });

  it('buying a surveyed slot charges both wallets and grows the island', () => {
    const slot = exp.surveys()[0]!;
    bus.emit('cmd:buyChunk', { cx: slot.cx, cz: slot.cz });
    expect(island.hasChunk(slot.cx, slot.cz)).toBe(true);
    expect(island.chunkCount).toBe(5);
    expect(popsSignal.get()).toBe(10000 - 250);
    expect(stardustSignal.get()).toBe(20 - 2);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0]!.index).toBe(5);
  });

  it('a non-offered slot cannot be bought (survey gating)', () => {
    bus.emit('cmd:buyChunk', { cx: 99, cz: 99 }); // never adjacent → never surveyed
    expect(island.chunkCount).toBe(4);
    expect(unlocked).toHaveLength(0);
  });

  it('insufficient Stardust denies the purchase without mutating either wallet', () => {
    loadWallet({ pops: 10000, stardust: 0 });
    const slot = exp.surveys()[0]!;
    bus.emit('cmd:buyChunk', { cx: slot.cx, cz: slot.cz });
    expect(island.chunkCount).toBe(4);
    expect(denied).toContain('stardust');
    expect(popsSignal.get()).toBe(10000); // pops untouched (atomic spend)
  });

  it('stops offering surveys and blocks buying at the soft cap', () => {
    let cx = 2;
    while (island.chunkCount < CHUNK_SOFT_CAP) island.addChunk(cx++, 0); // grow a long strip
    expect(island.chunkCount).toBe(CHUNK_SOFT_CAP);
    expect(exp.surveys()).toEqual([]); // invisible cap: offers just stop
    const candidate = island.expandableSlots()[0]!;
    bus.emit('cmd:buyChunk', { cx: candidate.cx, cz: candidate.cz });
    expect(island.chunkCount).toBe(CHUNK_SOFT_CAP); // no growth past the cap
  });
});
