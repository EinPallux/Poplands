/**
 * Save/Load v1 (S3, TECH §4): versioned JSON in localStorage with a rolling
 * 3-slot backup, debounced autosave, migrations registry, and export/import.
 * Placements are the world — meshes are a projection, rebuilt on load.
 *
 * core-layer purity: no three.js, no world imports; schema types are structural.
 */

export interface SavePlacement {
  id: string;
  def: string;
  wx: number;
  wz: number;
  rot: 0 | 1 | 2 | 3;
}

export interface SaveSettings {
  volume: number; // 0..1
  quality: 'auto' | 'high' | 'medium' | 'low';
  reducedMotion: boolean;
}

export interface SaveV1 {
  v: 1;
  createdAt: number;
  lastSeenAt: number;
  seed: number;
  player: { pops: number; stardust: number; xp: number; level: number };
  island: {
    chunks: Array<{ cx: number; cz: number; theme: 'meadow' | 'sandbar' | 'spooky' | 'snowcap' }>;
    placements: SavePlacement[];
  };
  /** Placements referencing unknown item defs are parked here, never dropped. */
  attic: SavePlacement[];
  settings: SaveSettings;
}

export const DEFAULT_SETTINGS: SaveSettings = { volume: 0.8, quality: 'auto', reducedMotion: false };

const KEY = 'poplands.save';
const BACKUP_KEYS = [`${KEY}.bak1`, `${KEY}.bak2`];
const AUTOSAVE_DEBOUNCE_MS = 5000;

/** Future migrations chain here: (older) → SaveV1-next. v1 is the first schema. */
type AnySave = { v: number } & Record<string, unknown>;
const migrations: Record<number, (s: AnySave) => AnySave> = {};

export function freshSave(seed: number, now: number): SaveV1 {
  return {
    v: 1,
    createdAt: now,
    lastSeenAt: now,
    seed,
    player: { pops: 150, stardust: 0, xp: 0, level: 1 },
    island: {
      chunks: [
        { cx: 0, cz: 0, theme: 'meadow' },
        { cx: 1, cz: 0, theme: 'meadow' },
        { cx: 0, cz: 1, theme: 'meadow' },
        { cx: 1, cz: 1, theme: 'meadow' },
      ],
      placements: [],
    },
    attic: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

function isPlausibleSave(data: unknown): data is AnySave {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as AnySave).v === 'number' &&
    typeof (data as { island?: unknown }).island === 'object'
  );
}

export function parseSave(json: string): SaveV1 | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isPlausibleSave(data)) return null;
  let save = data;
  while (save.v < 1) return null;
  while (migrations[save.v]) {
    save = migrations[save.v]!(save);
  }
  if (save.v !== 1) return null;
  const v1 = save as unknown as SaveV1;
  // normalize gently (older exports / hand-edited files)
  v1.attic ??= [];
  v1.settings = { ...DEFAULT_SETTINGS, ...v1.settings };
  v1.island.placements ??= [];
  return v1;
}

export class SaveManager {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private storage: Storage | null;

  constructor(private readonly collect: () => SaveV1) {
    this.storage = typeof localStorage === 'undefined' ? null : localStorage;
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.writeNow());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.writeNow();
      });
    }
  }

  /** Try main slot, then backups, oldest last. Null = no usable save. */
  load(): SaveV1 | null {
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
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.writeNow(), AUTOSAVE_DEBOUNCE_MS);
  }

  writeNow(): void {
    if (!this.storage) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      const current = this.storage.getItem(KEY);
      if (current) {
        // rotate backups: main → bak1 → bak2
        const bak1 = this.storage.getItem(BACKUP_KEYS[0]!);
        if (bak1) this.storage.setItem(BACKUP_KEYS[1]!, bak1);
        this.storage.setItem(BACKUP_KEYS[0]!, current);
      }
      const save = this.collect();
      save.lastSeenAt = Date.now();
      this.storage.setItem(KEY, JSON.stringify(save));
    } catch (err) {
      console.error('[save] write failed', err);
    }
  }

  exportString(): string {
    return JSON.stringify(this.collect());
  }

  /** Validate + persist an imported save. Caller reloads the world after. */
  importString(json: string): SaveV1 | null {
    const parsed = parseSave(json);
    if (!parsed || !this.storage) return null;
    this.storage.setItem(KEY, JSON.stringify(parsed));
    return parsed;
  }

  clearAll(): void {
    if (!this.storage) return;
    for (const key of [KEY, ...BACKUP_KEYS]) this.storage.removeItem(key);
  }
}
