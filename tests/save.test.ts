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

  it('deep-defaults present-but-partial nested slices (hand-edited saves never brick boot)', () => {
    // A hand-edited file where `postcards` is present but missing `skipped`, and
    // `player` is missing level/xp — the exact partial shape that used to survive
    // parse and then throw in the sim (eligiblePostcards sort on undefined / NaN HUD).
    const save = makeSave();
    const postcards = save.quests.postcards as unknown as Record<string, unknown>;
    delete postcards['skipped'];
    const player = save.player as unknown as Record<string, unknown>;
    delete player['level'];
    delete player['xp'];
    const parsed = parseSave(JSON.stringify(save));
    expect(parsed).not.toBeNull();
    // nested defaults filled → eligiblePostcards' sort can't read .includes on undefined
    expect(parsed!.quests.postcards.skipped).toEqual([]);
    expect(parsed!.player.level).toBe(1);
    expect(parsed!.player.xp).toBe(0);
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

  it('migrates a v1 save through to v8, seeding economy + quests + xpGranted + secrets + islanders + fishing + dailyGift + museum + achievements', () => {
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
    expect(parsed!.v).toBe(12); // chains v1→v2→…→v12
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
    // v3: empty secrets slice + the secretsFound counter (SecretSystem seeds on start)
    expect(parsed!.secrets).toEqual([]);
    expect(parsed!.quests.milestones.secretsFound).toBe(0);
    // v4: empty living-things roster slice (Islanders + Pals arrive on start)
    expect(parsed!.islanders.residents).toEqual([]);
    expect(parsed!.islanders.pals).toEqual([]);
    // v10: empty Pal pet counts (tricks are learned by petting)
    expect(parsed!.islanders.palPets).toEqual({});
    // v11: no custom names yet (island keeps its default title, everyone their roster name)
    expect(parsed!.islanders.names).toEqual({});
    expect(parsed!.islandName).toBeUndefined();
    // v5: empty fishing collection (fills as the player fishes)
    expect(parsed!.fishing.caught).toEqual({});
    expect(parsed!.fishing.total).toBe(0);
    // v6: un-claimed daily-gift slice (the first gift is ready)
    expect(parsed!.dailyGift.lastClaimDay).toBe(0);
    expect(parsed!.dailyGift.claims).toBe(0);
    // v7: empty museum slice (nothing on display yet)
    expect(parsed!.museum.donated).toEqual([]);
    // v8: empty Stamp Book (AchievementSystem grants earned stamps on start)
    expect(parsed!.achievements.earned).toEqual([]);
    // v9: bare garden (no plots planted, nothing harvested)
    expect(parsed!.garden.plots).toEqual({});
    expect(parsed!.garden.harvested).toBe(0);
    // v12: no saved camera viewpoints yet
    expect(parsed!.bookmarks).toEqual([]);
  });

  it('a v4 save missing the islanders slice normalizes to an empty roster', () => {
    const save = makeSave() as unknown as Record<string, unknown>;
    delete save['islanders'];
    const parsed = parseSave(JSON.stringify(save));
    expect(parsed).not.toBeNull();
    expect(parsed!.islanders.residents).toEqual([]);
  });

  it('a save predating the fishing slice normalizes to an empty collection', () => {
    const save = makeSave() as unknown as Record<string, unknown>;
    delete save['fishing'];
    const parsed = parseSave(JSON.stringify(save));
    expect(parsed).not.toBeNull();
    expect(parsed!.fishing.caught).toEqual({});
    expect(parsed!.fishing.total).toBe(0);
  });

  it('a save predating the daily-gift slice normalizes to un-claimed', () => {
    const save = makeSave() as unknown as Record<string, unknown>;
    delete save['dailyGift'];
    const parsed = parseSave(JSON.stringify(save));
    expect(parsed).not.toBeNull();
    expect(parsed!.dailyGift.lastClaimDay).toBe(0);
    expect(parsed!.dailyGift.claims).toBe(0);
  });

  it('a save predating the museum slice normalizes to an empty hall', () => {
    const save = makeSave() as unknown as Record<string, unknown>;
    delete save['museum'];
    const parsed = parseSave(JSON.stringify(save));
    expect(parsed).not.toBeNull();
    expect(parsed!.museum.donated).toEqual([]);
  });

  it('a save predating the achievements slice normalizes to an empty Stamp Book', () => {
    const save = makeSave() as unknown as Record<string, unknown>;
    delete save['achievements'];
    const parsed = parseSave(JSON.stringify(save));
    expect(parsed).not.toBeNull();
    expect(parsed!.achievements.earned).toEqual([]);
  });

  it('a save predating the garden slice normalizes to a bare garden', () => {
    const save = makeSave() as unknown as Record<string, unknown>;
    delete save['garden'];
    const parsed = parseSave(JSON.stringify(save));
    expect(parsed).not.toBeNull();
    expect(parsed!.garden.plots).toEqual({});
    expect(parsed!.garden.harvested).toBe(0);
  });

  it('back-fills a new settings field (uiScale) on a save that predates it', () => {
    // The uiScale accessibility setting (S23) shipped without a version bump —
    // normalize()'s `{ ...DEFAULT_SETTINGS, ...settings }` must default any older
    // save's settings blob (which never persisted uiScale) to 1.
    const save = makeSave();
    const settings = save.settings as unknown as Record<string, unknown>;
    delete settings['uiScale'];
    const parsed = parseSave(JSON.stringify(save));
    expect(parsed).not.toBeNull();
    expect(parsed!.settings.uiScale).toBe(1);
    // pre-existing settings values still survive the merge
    expect(parsed!.settings.volume).toBe(save.settings.volume);
  });

  it('back-fills the musicVolume setting on a save that predates the bgm option', () => {
    // musicVolume (optional bgm.mp3, S22) also shipped without a version bump — an
    // older save's settings blob never persisted it, so normalize() must default it.
    const save = makeSave();
    const settings = save.settings as unknown as Record<string, unknown>;
    delete settings['musicVolume'];
    const parsed = parseSave(JSON.stringify(save));
    expect(parsed).not.toBeNull();
    expect(parsed!.settings.musicVolume).toBeGreaterThan(0);
    expect(parsed!.settings.volume).toBe(save.settings.volume); // siblings untouched
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

  it('keeps the main save when storage is nearly full (sacrifices backups)', () => {
    // A storage that rejects any write pushing total size over a tight budget —
    // simulating a near-full localStorage. The main save must survive by dropping
    // the recovery backups rather than being lost.
    class QuotaStorage extends MemoryStorage {
      constructor(private readonly budget: number) {
        super();
      }
      override setItem(k: string, v: string): void {
        let total = v.length;
        for (let i = 0; i < this.length; i++) {
          const key = this.key(i)!;
          if (key !== k) total += this.getItem(key)!.length;
        }
        if (total > this.budget) {
          const err = new Error('quota'); // Node-safe stand-in for QuotaExceededError
          err.name = 'QuotaExceededError';
          throw err;
        }
        super.setItem(k, v);
      }
    }
    const save = makeSave();
    const oneSize = JSON.stringify(save).length;
    // budget ≈ 2.4 saves: two pre-existing backups fit, but main + both do not, so
    // the first main write throws and must free the backups and retry.
    vi.stubGlobal('localStorage', new QuotaStorage(Math.floor(oneSize * 2.4)));
    localStorage.setItem('poplands.save.bak1', 'x'.repeat(oneSize)); // near-full backups
    localStorage.setItem('poplands.save.bak2', 'x'.repeat(oneSize));

    const mgr = new SaveManager(() => save);
    mgr.writeNow(); // main write overflows → drop backups → retry → succeeds

    const loaded = mgr.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.pops).toBe(275); // the main save survived the squeeze
    expect(localStorage.getItem('poplands.save.bak1')).toBeNull(); // backups sacrificed
    expect(localStorage.getItem('poplands.save.bak2')).toBeNull();
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
