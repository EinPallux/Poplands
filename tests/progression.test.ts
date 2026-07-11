import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyXp,
  placementXp,
  levelReward,
  tierUnlockLevel,
  tierUnlockedAt,
  itemsUnlockedAt,
} from '@/sim/progression';
import { xpToNext, MAX_LEVEL, levelSignal, xpSignal, loadPlayer } from '@/core/playerStore';
import { ProgressionSystem } from '@/sim/ProgressionSystem';
import { bus } from '@/core/events';

describe('xp curve', () => {
  it('matches the design formula at low levels', () => {
    expect(xpToNext(1)).toBe(60);
    expect(xpToNext(2)).toBe(180);
    expect(xpToNext(3)).toBe(330);
    expect(xpToNext(4)).toBe(510);
    expect(xpToNext(5)).toBe(730);
  });

  it('is Infinity at the cap (no more XP needed)', () => {
    expect(xpToNext(MAX_LEVEL)).toBe(Infinity);
  });
});

describe('applyXp', () => {
  it('accrues without leveling below the threshold', () => {
    const r = applyXp({ level: 1, xp: 0 }, 30);
    expect(r).toEqual({ level: 1, xp: 30, leveled: [] });
  });

  it('advances one level and carries the remainder', () => {
    const r = applyXp({ level: 1, xp: 0 }, 100); // need 60 for L2
    expect(r.level).toBe(2);
    expect(r.xp).toBe(40);
    expect(r.leveled).toEqual([2]);
  });

  it('advances multiple levels in one grant', () => {
    const r = applyXp({ level: 1, xp: 0 }, 60 + 180 + 5); // through L2 and L3
    expect(r.level).toBe(3);
    expect(r.xp).toBe(5);
    expect(r.leveled).toEqual([2, 3]);
  });

  it('discards excess XP at the cap (no penalty)', () => {
    const r = applyXp({ level: MAX_LEVEL, xp: 0 }, 9999);
    expect(r).toEqual({ level: MAX_LEVEL, xp: 0, leveled: [] });
  });
});

describe('rewards & tiers', () => {
  it('placementXp is at least 1 and scales with cost', () => {
    expect(placementXp(8)).toBe(1);
    expect(placementXp(150)).toBe(15);
  });

  it('level rewards give Stardust only from L5', () => {
    expect(levelReward(3).stardust).toBe(0);
    expect(levelReward(5).stardust).toBe(3);
    expect(levelReward(6).stardust).toBe(1);
  });

  it('tiers 1-2 are starter (level 1); tier N≥3 unlocks at level N', () => {
    expect(tierUnlockLevel(1)).toBe(1);
    expect(tierUnlockLevel(2)).toBe(1); // stall/hut/lantern available during the tutorial
    expect(tierUnlockLevel(3)).toBe(3);
    expect(tierUnlockLevel(6)).toBe(6);
    // reveal fires only for tiers that gate at a level-up (3..6)
    expect(tierUnlockedAt(1)).toBeNull();
    expect(tierUnlockedAt(2)).toBeNull();
    expect(tierUnlockedAt(3)).toBe(3);
    expect(tierUnlockedAt(10)).toBe(10); // MAX_TIER is now 10 (Tier 7–10 Riverside/Harbor)
    expect(tierUnlockedAt(11)).toBeNull(); // beyond the top tier
    expect(itemsUnlockedAt(3).length).toBeGreaterThan(0);
    expect(itemsUnlockedAt(1)).toEqual([]);
  });
});

describe('ProgressionSystem', () => {
  beforeEach(() => {
    loadPlayer({ level: 1, xp: 0 });
  });

  it('grants placement XP once per unique id (move/replace is free)', () => {
    const player = { level: 1, xp: 0, xpGranted: [] as string[] };
    const prog = new ProgressionSystem(player);
    prog.wire();
    const levelUps: number[] = [];
    const off = bus.on('level:up', (e) => levelUps.push(e.level));

    // place income.stall (cost 100 → 10 XP) three times as the SAME id
    for (let i = 0; i < 3; i++) {
      bus.emit('item:placed', { id: 'p1', def: 'income.stall', wx: 0, wz: 0, rot: 0 });
    }
    expect(player.xp).toBe(10); // granted once, not 30
    expect(player.xpGranted).toEqual(['p1']);

    // a silent (hydration / move-return) placement never grants
    bus.emit('item:placed', { id: 'p2', def: 'income.stall', wx: 1, wz: 1, rot: 0, silent: true });
    expect(player.xp).toBe(10);

    off();
    prog.dispose();
  });

  it('emits level:up when XP crosses a threshold; L2 is a starter level (no tier reveal)', () => {
    const player = { level: 1, xp: 55, xpGranted: [] as string[] };
    const prog = new ProgressionSystem(player);
    let evt: { level: number; unlockedTier: number | null; newItems: string[] } | null = null;
    const off = bus.on('level:up', (e) => (evt = e));
    prog.grantXp(10, 'quest'); // 55 + 10 = 65 ≥ 60 → L2
    expect(player.level).toBe(2);
    expect(levelSignal.get()).toBe(2);
    expect(evt).not.toBeNull();
    expect(evt!.level).toBe(2);
    expect(evt!.unlockedTier).toBeNull(); // tiers 1-2 available from the start
    expect(evt!.newItems).toEqual([]);
    off();
  });

  it('reaching level 3 reveals Tier 3 items', () => {
    const player = { level: 2, xp: 320, xpGranted: [] as string[] };
    const prog = new ProgressionSystem(player);
    let evt: { level: number; unlockedTier: number | null; newItems: string[] } | null = null;
    const off = bus.on('level:up', (e) => (evt = e));
    prog.grantXp(20, 'quest'); // 320 + 20 = 340 ≥ 330 → L3
    expect(player.level).toBe(3);
    expect(evt!.unlockedTier).toBe(3);
    expect(evt!.newItems.length).toBeGreaterThan(0);
    off();
  });

  it('does not grant past the cap', () => {
    const player = { level: MAX_LEVEL, xp: 0, xpGranted: [] as string[] };
    const prog = new ProgressionSystem(player);
    prog.grantXp(500, 'quest');
    expect(player.level).toBe(MAX_LEVEL);
    expect(xpSignal.get()).toBe(0);
  });
});
