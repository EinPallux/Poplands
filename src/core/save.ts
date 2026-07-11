/**
 * Save/Load v1 (S3, TECH §4): versioned JSON in localStorage with a rolling
 * 3-slot backup, debounced autosave, migrations registry, and export/import.
 * Placements are the world — meshes are a projection, rebuilt on load.
 *
 * core-layer purity: no three.js, no world imports; schema types are structural.
 */
import type { SecretKind } from './events';
import type { ChunkTheme } from './grid';

export interface SavePlacement {
  id: string;
  def: string;
  wx: number;
  wz: number;
  rot: 0 | 1 | 2 | 3;
}

export interface SaveSettings {
  volume: number; // 0..1 — SFX / ambient
  musicVolume: number; // 0..1 — optional user-supplied bgm.mp3 (S22)
  quality: 'auto' | 'high' | 'medium' | 'low';
  reducedMotion: boolean;
  timeOfDay: 'auto' | 'day' | 'dusk' | 'night'; // 'auto' = cycle; others freeze the sky
  season: 'auto' | 'spring' | 'summer' | 'autumn' | 'winter'; // 'auto' = follow the real month
  fpsCap: 'off' | '30' | '60'; // frame-rate cap (S23)
  uiScale: number; // 0.85 | 1 | 1.15 | 1.3 — UI zoom (S23 accessibility)
}

/** Per-income-building banked Pops + collection timestamp (S13). */
export interface SaveEconomy {
  accrual: Array<{ id: string; storedPops: number; lastCollectAt: number }>;
}

/** Lifetime counters that drive milestones. */
export type CounterId = 'itemsPlaced' | 'popsCollected' | 'questsDone' | 'levelsGained' | 'secretsFound';

/** A per-chunk secret (S19): seeded on chunk arrival, `found` latches on discovery. */
export interface SaveSecret {
  cx: number;
  cz: number;
  kind: SecretKind;
  wx: number; // marker cell
  wz: number;
  clicks: number; // dig progress, 0..clicksToOpen
  found: boolean; // latches true, never un-latches
  reward: { pops: number; stardust: number; xp: number };
}

/** Persisted living-things roster (S16 Islanders + S18 Pals). `residents`/`pals` are
 *  roster ids in arrival order; both lists are monotonic (nobody is ever evicted).
 *  Live kinematics (positions, headings) are NOT persisted — they re-scatter on load. */
export interface SaveIslanders {
  residents: string[];
  pals: string[];
}

/** Persisted fishing collection (post-1.0): `caught` maps a stable fish-species id
 *  to how many of that species you've reeled in; `total` is the lifetime catch count.
 *  Species not yet caught are simply absent (the journal renders them locked). */
export interface SaveFishing {
  caught: Record<string, number>;
  total: number;
}

/** Persisted daily-gift state (post-1.0): `lastClaimDay` is a YYYYMMDD day key of
 *  the last claim (0 = never), `claims` is the lifetime claim count (drives the
 *  looping 7-day reward cycle). Missing days never punish — the cycle is per-claim. */
export interface SaveDailyGift {
  lastClaimDay: number;
  claims: number;
}

/** Persisted museum state (post-1.0): `donated` is the set of fish-species ids put
 *  on display in the Collections Hall (a stable id list; donating is one-time per species). */
export interface SaveMuseum {
  donated: string[];
}

/** Persisted Stamp Book (post-1.0): the ids of achievements already earned. */
export interface SaveAchievements {
  earned: string[];
}

/** Persisted Garden plots (post-1.0): what's planted where (by placement id, with an
 *  absolute plant timestamp so growth continues offline) + a lifetime harvest tally. */
export interface SaveGarden {
  plots: Record<string, { crop: string; plantedAt: number }>;
  harvested: number;
}

/** Persisted quest state (S15). Cumulative predicates keep per-quest counters in `progress`. */
export interface SaveQuests {
  tutorial: { activeId: string | null; done: string[] };
  postcards: {
    active: Array<{ id: string; progress: number }>;
    done: string[];
    skipped: string[];
    cooldownUntil: number;
  };
  progress: Record<string, number>;
  milestones: Record<CounterId, number>;
  milestoneTier: Record<string, number>;
  freePlayUnlocked: boolean;
}

/** v1 was the first shipped schema (v0.2). Kept for migration typing. */
export interface SaveV1 {
  v: 1;
  createdAt: number;
  lastSeenAt: number;
  seed: number;
  player: { pops: number; stardust: number; xp: number; level: number };
  island: {
    chunks: Array<{ cx: number; cz: number; theme: ChunkTheme }>;
    placements: SavePlacement[];
  };
  attic: SavePlacement[];
  settings: SaveSettings;
}

/** v2 (v0.3): adds economy accrual, XP ledger, and quest state. */
export interface SaveV2 {
  v: 2;
  createdAt: number;
  lastSeenAt: number;
  seed: number;
  player: { pops: number; stardust: number; xp: number; level: number; xpGranted: string[] };
  island: {
    chunks: Array<{ cx: number; cz: number; theme: ChunkTheme }>;
    placements: SavePlacement[];
  };
  economy: SaveEconomy;
  quests: SaveQuests;
  /** Placements referencing unknown item defs are parked here, never dropped. */
  attic: SavePlacement[];
  settings: SaveSettings;
}

/** v3 (v0.4): per-chunk secrets (S19) + the secretsFound milestone counter. */
export interface SaveV3 extends Omit<SaveV2, 'v'> {
  v: 3;
  secrets: SaveSecret[];
}

/** v4 (v0.5): the Islander roster slice (S16). */
export interface SaveV4 extends Omit<SaveV3, 'v'> {
  v: 4;
  islanders: SaveIslanders;
}

/** v5 (post-1.0): the fishing collection slice. */
export interface SaveV5 extends Omit<SaveV4, 'v'> {
  v: 5;
  fishing: SaveFishing;
}

/** v6 (post-1.0): the daily-gift slice. */
export interface SaveV6 extends Omit<SaveV5, 'v'> {
  v: 6;
  dailyGift: SaveDailyGift;
}

/** v7 (post-1.0): the museum (Collections Hall) slice. */
export interface SaveV7 extends Omit<SaveV6, 'v'> {
  v: 7;
  museum: SaveMuseum;
}

/** v8 (post-1.0): the achievements (Stamp Book) slice. */
export interface SaveV8 extends Omit<SaveV7, 'v'> {
  v: 8;
  achievements: SaveAchievements;
}

/** v9 (post-1.0): the garden (Crop Patch) slice. */
export interface SaveV9 extends Omit<SaveV8, 'v'> {
  v: 9;
  garden: SaveGarden;
}

/** The current schema. Bump this alias (not scattered `SaveVn`s) each version. */
export type Save = SaveV9;
export const SAVE_VERSION = 9;

export const DEFAULT_SETTINGS: SaveSettings = {
  volume: 0.8,
  musicVolume: 0.5,
  quality: 'auto',
  reducedMotion: false,
  timeOfDay: 'auto',
  season: 'auto',
  fpsCap: 'off',
  uiScale: 1,
};

const KEY = 'poplands.save';
const BACKUP_KEYS = [`${KEY}.bak1`, `${KEY}.bak2`];
const AUTOSAVE_DEBOUNCE_MS = 5000;

export function freshEconomy(): SaveEconomy {
  return { accrual: [] };
}

export function freshIslanders(): SaveIslanders {
  return { residents: [], pals: [] };
}

export function freshFishing(): SaveFishing {
  return { caught: {}, total: 0 };
}

export function freshDailyGift(): SaveDailyGift {
  return { lastClaimDay: 0, claims: 0 };
}

export function freshMuseum(): SaveMuseum {
  return { donated: [] };
}

export function freshAchievements(): SaveAchievements {
  return { earned: [] };
}

export function freshGarden(): SaveGarden {
  return { plots: {}, harvested: 0 };
}

/**
 * Fold a Move-mode carried placement back into the snapshot at its home, so a
 * building held mid-move is never lost if a save lands before the drop (the
 * no-fail-state covenant). Pure — GameState.collect() uses it.
 */
export function withCarried(placements: SavePlacement[], carried: SavePlacement | null): SavePlacement[] {
  if (!carried || placements.some((p) => p.id === carried.id)) return placements;
  return [...placements, carried];
}

/** Fresh quest state. `activeId: null` — QuestSystem.announce() seeds the first
 * tutorial step on a genuinely-fresh save, so this stays content-free (core layer). */
export function freshQuests(itemsPlaced = 0): SaveQuests {
  return {
    tutorial: { activeId: null, done: [] },
    postcards: { active: [], done: [], skipped: [], cooldownUntil: 0 },
    progress: {},
    milestones: { itemsPlaced, popsCollected: 0, questsDone: 0, levelsGained: 0, secretsFound: 0 },
    milestoneTier: {},
    freePlayUnlocked: false,
  };
}

/** Migrations chain: index N transforms a vN save into v(N+1). */
type AnySave = { v: number } & Record<string, unknown>;
const migrations: Record<number, (s: AnySave) => AnySave> = {
  1: (s) => {
    const v1 = s as unknown as SaveV1;
    const placements = v1.island?.placements ?? [];
    return {
      ...v1,
      v: 2,
      player: { ...v1.player, xpGranted: placements.map((p) => p.id) }, // pre-economy items = already XP-granted
      economy: freshEconomy(),
      quests: freshQuests(placements.length),
    } as unknown as AnySave;
  },
  2: (s) => {
    const v2 = s as unknown as SaveV2;
    // Secrets are seeded per-chunk by the sim (SecretSystem, which owns the content
    // roll) on first start — the migration just adds the empty slice + counter.
    return {
      ...v2,
      v: 3,
      secrets: [],
      quests: {
        ...v2.quests,
        milestones: { ...v2.quests.milestones, secretsFound: v2.quests.milestones?.secretsFound ?? 0 },
      },
    } as unknown as AnySave;
  },
  3: (s) => {
    const v3 = s as unknown as SaveV3;
    // Residents re-derive from home capacity on first start (IslanderSystem owns the
    // roster roll) — the migration just adds the empty slice.
    return { ...v3, v: 4, islanders: freshIslanders() } as unknown as AnySave;
  },
  4: (s) => {
    const v4 = s as unknown as SaveV4;
    // The fishing collection starts empty — nothing to back-fill.
    return { ...v4, v: 5, fishing: freshFishing() } as unknown as AnySave;
  },
  5: (s) => {
    const v5 = s as unknown as SaveV5;
    // Daily-gift starts un-claimed (lastClaimDay 0 → the first gift is ready).
    return { ...v5, v: 6, dailyGift: freshDailyGift() } as unknown as AnySave;
  },
  6: (s) => {
    const v6 = s as unknown as SaveV6;
    // The museum starts empty — nothing on display yet.
    return { ...v6, v: 7, museum: freshMuseum() } as unknown as AnySave;
  },
  7: (s) => {
    const v7 = s as unknown as SaveV7;
    // The Stamp Book starts empty; AchievementSystem.announce() silently grants any
    // stamps the returning player has already earned on first evaluation.
    return { ...v7, v: 8, achievements: freshAchievements() } as unknown as AnySave;
  },
  8: (s) => {
    const v8 = s as unknown as SaveV8;
    // No plots planted yet — the garden starts bare.
    return { ...v8, v: 9, garden: freshGarden() } as unknown as AnySave;
  },
};

export function freshSave(seed: number, now: number): Save {
  return {
    v: 9,
    createdAt: now,
    lastSeenAt: now,
    seed,
    player: { pops: 150, stardust: 0, xp: 0, level: 1, xpGranted: [] },
    island: {
      chunks: [
        { cx: 0, cz: 0, theme: 'meadow' },
        { cx: 1, cz: 0, theme: 'meadow' },
        { cx: 0, cz: 1, theme: 'meadow' },
        { cx: 1, cz: 1, theme: 'meadow' },
      ],
      placements: [],
    },
    economy: freshEconomy(),
    quests: freshQuests(0),
    secrets: [], // SecretSystem seeds the starter chunks' secrets on first start
    islanders: freshIslanders(), // IslanderSystem welcomes residents as homes appear
    fishing: freshFishing(), // empty catch log; fills as the player fishes
    dailyGift: freshDailyGift(), // un-claimed; the first gift is ready on day one
    museum: freshMuseum(), // empty Collections Hall
    achievements: freshAchievements(), // empty Stamp Book
    garden: freshGarden(), // no crops planted yet
    attic: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isPlausibleSave(data: unknown): data is AnySave {
  // NB: `typeof null === 'object'`, so null-check island/player explicitly —
  // otherwise a corrupt {island:null} save passes the guard and later throws
  // in the normalizers, bricking boot instead of falling through to backups.
  return (
    isObject(data) &&
    typeof data['v'] === 'number' &&
    isObject(data['island']) &&
    isObject(data['player'])
  );
}

export function parseSave(json: string): Save | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isPlausibleSave(data)) return null;
  try {
    let save = data;
    if (save.v < 1) return null;
    while (migrations[save.v]) {
      save = migrations[save.v]!(save);
    }
    if (save.v !== SAVE_VERSION) return null;
    return normalize(save as unknown as Save);
  } catch {
    // any surprise (hand-edited / partially-corrupt slice) → treat as unusable so
    // load() falls through to the backup slots or a fresh save (no fail states).
    return null;
  }
}

function normalize(v2: Save): Save {
  // normalize gently (older exports / hand-edited files / partial slices). Default
  // NESTED fields too, not just top-level slices: a present-but-partial object must
  // never survive parse and then throw in the sim at boot. (A `postcards` missing
  // its `skipped` array would crash the eligiblePostcards sort → brick load, which
  // the no-fail-states covenant forbids; a `player` missing `level`/`xp` would NaN
  // the HUD.) A wrong-TYPED slice still throws here and is caught by parseSave → backup.
  v2.attic ??= [];
  v2.secrets ??= [];
  v2.islanders ??= freshIslanders();
  v2.islanders.residents ??= [];
  v2.islanders.pals ??= [];
  v2.fishing ??= freshFishing();
  v2.fishing.caught ??= {};
  v2.fishing.total ??= 0;
  v2.dailyGift ??= freshDailyGift();
  v2.dailyGift.lastClaimDay ??= 0;
  v2.dailyGift.claims ??= 0;
  v2.museum ??= freshMuseum();
  v2.museum.donated ??= [];
  v2.achievements ??= freshAchievements();
  v2.achievements.earned ??= [];
  v2.garden ??= freshGarden();
  v2.garden.plots ??= {};
  v2.garden.harvested ??= 0;
  v2.settings = { ...DEFAULT_SETTINGS, ...v2.settings };
  v2.island.placements ??= [];
  v2.player.level ??= 1;
  v2.player.xp ??= 0;
  v2.player.pops ??= 0;
  v2.player.stardust ??= 0;
  v2.player.xpGranted ??= [];
  v2.economy ??= freshEconomy();
  v2.economy.accrual ??= [];
  v2.quests ??= freshQuests(v2.island.placements.length);
  v2.quests.freePlayUnlocked ??= false;
  v2.quests.progress ??= {};
  v2.quests.milestones ??= { itemsPlaced: 0, popsCollected: 0, questsDone: 0, levelsGained: 0, secretsFound: 0 };
  v2.quests.milestones.secretsFound ??= 0;
  v2.quests.milestoneTier ??= {};
  v2.quests.postcards ??= { active: [], done: [], skipped: [], cooldownUntil: 0 };
  v2.quests.postcards.active ??= [];
  v2.quests.postcards.done ??= [];
  v2.quests.postcards.skipped ??= [];
  v2.quests.postcards.cooldownUntil ??= 0;
  v2.quests.tutorial ??= { activeId: null, done: [] };
  v2.quests.tutorial.activeId ??= null;
  v2.quests.tutorial.done ??= [];
  return v2;
}

export class SaveManager {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private storage: Storage | null;
  /** After an import replaces the save (a reload is imminent), stop autosaving so the
   *  pagehide / visibilitychange writeNow can't clobber the freshly-imported save with
   *  the now-stale in-memory state. */
  private suspended = false;

  constructor(private readonly collect: () => Save) {
    this.storage = typeof localStorage === 'undefined' ? null : localStorage;
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.writeNow());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.writeNow();
      });
    }
  }

  /** Try main slot, then backups, oldest last. Null = no usable save. */
  load(): Save | null {
    if (!this.storage) return null;
    for (const key of [KEY, ...BACKUP_KEYS]) {
      const raw = this.storage.getItem(key);
      if (!raw) continue;
      const parsed = parseSave(raw);
      if (parsed) {
        if (key !== KEY) console.warn(`[save] main slot unusable, recovered from ${key}`);
        return parsed;
      }
    }
    return null;
  }

  /** Debounced autosave — call on any mutating domain event. */
  requestSave(): void {
    if (this.suspended) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.writeNow(), AUTOSAVE_DEBOUNCE_MS);
  }

  writeNow(): void {
    if (!this.storage || this.suspended) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    let payload: string;
    try {
      const save = this.collect();
      save.lastSeenAt = Date.now();
      payload = JSON.stringify(save);
    } catch (err) {
      console.error('[save] collect/serialize failed', err);
      return;
    }
    // Rotate backups best-effort — a full backup SLOT must never block the real
    // save (the main slot is load-bearing; backups are a luxury).
    try {
      const current = this.storage.getItem(KEY);
      if (current) {
        const bak1 = this.storage.getItem(BACKUP_KEYS[0]!);
        if (bak1) this.storage.setItem(BACKUP_KEYS[1]!, bak1);
        this.storage.setItem(BACKUP_KEYS[0]!, current);
      }
    } catch {
      /* backup rotation failed (likely quota) — proceed to the main save anyway */
    }
    // The main save matters most. On quota, free the backups and retry once, so a
    // nearly-full localStorage sacrifices recovery history rather than the save.
    try {
      this.storage.setItem(KEY, payload);
    } catch {
      try {
        this.storage.removeItem(BACKUP_KEYS[1]!);
        this.storage.removeItem(BACKUP_KEYS[0]!);
        this.storage.setItem(KEY, payload);
        console.warn('[save] storage full — dropped backups to keep the main save');
      } catch (err) {
        console.error('[save] write failed (storage full even after clearing backups)', err);
      }
    }
  }

  exportString(): string {
    return JSON.stringify(this.collect());
  }

  /** Validate + persist an imported save. Caller reloads the world after. Suspends
   *  autosave so the imminent reload's pagehide writeNow can't overwrite the imported
   *  save with the stale in-memory state. */
  importString(json: string): Save | null {
    const parsed = parseSave(json);
    if (!parsed || !this.storage) return null;
    this.storage.setItem(KEY, JSON.stringify(parsed));
    this.suspended = true;
    return parsed;
  }

  clearAll(): void {
    if (!this.storage) return;
    for (const key of [KEY, ...BACKUP_KEYS]) this.storage.removeItem(key);
  }
}
