import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseSave, freshSave, SaveManager, withCarried, type Save, type SavePlacement } from '@/core/save';

// minimal in-memory localStorage for node
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

const makeSave = (): Save => {
  const s = freshSave(42, 1000);
  s.island.placements.push({ id: 'p1', def: 'nature.tree', wx: 3, wz: 4, rot: 1 });
  s.player.pops = 275;
  return s;
};

describe('parseSave', () => {
  it('round-trips a save', () => {
    const save = makeSave();
    const parsed = parseSave(JSON.stringify(save));
    expect(parsed).not.toBeNull();
    expect(parsed!.island.placements).toHaveLength(1);
    expect(parsed!.player.pops).toBe(275);
    expect(parsed!.seed).toBe(42);
  });

  it('rejects garbage and wrong shapes', () => {
    expect(parseSave('not json')).toBeNull();
    expect(parseSave('{"v":99}')).toBeNull();
    expect(parseSave('{"hello":true}')).toBeNull();
  });

  it('rejects corrupt saves (null island/player) instead of throwing', () => {
    // typeof null === 'object' — these must be rejected so load() falls to backups
    expect(parseSave('{"v":2,"island":null,"player":{"pops":1}}')).toBeNull();
    expect(parseSave('{"v":2,"island":{"placements":[]},"player":null}')).toBeNull();
  });

  it('normalizes missing optional fields', () => {
    const save = makeSave() as unknown as Record<string, unknown>;
    delete save['attic'];
    delete save['settings'];
    const parsed = parseSave(JSON.stringify(save));
    expect(parsed!.attic).toEqual([]);
    expect(parsed!.settings.volume).toBeGreaterThan(0);
  });

  it('withCarried folds a Move-mode item back into the snapshot (no data loss)', () => {
    const placements: SavePlacement[] = [{ id: 'p1', def: 'nature.tree', wx: 1, wz: 1, rot: 0 }];
    const carried: SavePlacement = { id: 'p2', def: 'income.stall', wx: 5, wz: 5, rot: 0 };
    const folded = withCarried(placements, carried);
    expect(folded).toHaveLength(2);
    expect(folded.some((p) => p.id === 'p2')).toBe(true);
    // idempotent: never duplicates an already-present item
    expect(withCarried(folded, carried)).toHaveLength(2);
    // null carried is a no-op
    expect(withCarried(placements, null)).toBe(placements);
  });

  it('migrates a v1 save to v2, seeding economy + quests + xpGranted', () => {
    // a hand-built v0.2-era v1 save
    const v1 = {
      v: 1,
      createdAt: 1,
      lastSeenAt: 1,
      seed: 7,
      player: { pops: 300, stardust: 4, xp: 20, level: 2 },
      island: {
        chunks: [{ cx: 0, cz: 0, theme: 'meadow' }],
        placements: [
          { id: 'p1', def: 'nature.tree', wx: 1, wz: 1, rot: 0 },
          { id: 'p2', def: 'income.stall', wx: 3, wz: 3, rot: 0 },
        ],
      },
      attic: [],
      settings: { volume: 0.5, quality: 'high', reducedMotion: false },
    };
    const parsed = parseSave(JSON.stringify(v1));
    expect(parsed).not.toBeNull();
    expect(parsed!.v).toBe(2);
    // wallets preserved, not reset
    expect(parsed!.player.pops).toBe(300);
    expect(parsed!.player.level).toBe(2);
    // pre-economy placements marked already-XP-granted (no retroactive windfall)
    expect(parsed!.player.xpGranted).toEqual(['p1', 'p2']);
    // fresh economy + quest slices seeded
    expect(parsed!.economy.accrual).toEqual([]);
    expect(parsed!.quests.tutorial.activeId).toBeNull();
    expect(parsed!.quests.milestones.itemsPlaced).toBe(2);
    expect(parsed!.quests.freePlayUnlocked).toBe(false);
  });
});

describe('SaveManager', () => {
  it('writes, loads, and rotates backups', () => {
    let current = makeSave();
    const mgr = new SaveManager(() => current);
    mgr.writeNow();
    current = { ...current, player: { ...current.player, pops: 999 } };
    mgr.writeNow(); // rotates first write into bak1
    const loaded = mgr.load();
    expect(loaded!.player.pops).toBe(999);
    // corrupt the main slot → recovery from backup
    localStorage.setItem('poplands.save', '{corrupt');
    const recovered = mgr.load();
    expect(recovered).not.toBeNull();
    expect(recovered!.player.pops).toBe(275); // the backup (first write)
  });

  it('returns null with no save present', () => {
    const mgr = new SaveManager(() => makeSave());
    expect(mgr.load()).toBeNull();
  });

  it('import validates before persisting', () => {
    const mgr = new SaveManager(() => makeSave());
    expect(mgr.importString('junk')).toBeNull();
    expect(mgr.load()).toBeNull(); // nothing persisted
    const ok = mgr.importString(JSON.stringify(makeSave()));
    expect(ok).not.toBeNull();
    expect(mgr.load()!.seed).toBe(42);
  });
});
