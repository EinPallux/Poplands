import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseSave, freshSave, SaveManager, type SaveV1 } from '@/core/save';

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

const makeSave = (): SaveV1 => {
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

  it('normalizes missing optional fields', () => {
    const save = makeSave() as unknown as Record<string, unknown>;
    delete save['attic'];
    delete save['settings'];
    const parsed = parseSave(JSON.stringify(save));
    expect(parsed!.attic).toEqual([]);
    expect(parsed!.settings.volume).toBeGreaterThan(0);
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
