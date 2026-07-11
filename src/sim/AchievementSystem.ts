/**
 * Achievements / Stamp Book (post-1.0): awards lifetime milestone stamps. THREE.JS-FREE.
 *
 * On any progress event it assembles a plain stats snapshot (from injected providers —
 * the live systems) and evaluates every un-earned stamp's pure predicate; newly passing
 * stamps are latched forever and announced via `achievement:earned` (the UI celebrates,
 * like fishing/museum rewards). Earning is ONE-WAY and never expires — the no-FOMO
 * covenant (GDD §7.5). `announce()` on start does a SILENT retroactive grant so a
 * returning player's Stamp Book reflects what they've already done, without a burst of
 * celebrations; only stamps earned during live play pop a toast. Mutates the save slice.
 */
import { bus } from '@/core/events';
import { ACHIEVEMENTS, type AchievementStats, type AchievementCategory } from '@/content/achievements';
import type { StringKey } from '@/core/strings';
import type { SaveAchievements } from '@/core/save';

/** Events after which a stamp might newly qualify (each just triggers a re-evaluation). */
const TRIGGERS = [
  'item:placed',
  'income:collected',
  'level:up',
  'secret:found',
  'quest:completed',
  'chunk:unlocked',
  'fishing:caught',
  'museum:donated',
  'npc:arrived',
  'pal:adopted',
  'gift:claimed',
] as const;

export interface StampView {
  id: string;
  nameKey: StringKey;
  descKey: StringKey;
  icon: string;
  category: AchievementCategory;
  earned: boolean;
}

export class AchievementSystem {
  private readonly earned: Set<string>;
  private unsubs: Array<() => void> = [];

  constructor(
    private readonly state: SaveAchievements,
    private readonly stats: () => AchievementStats,
  ) {
    this.earned = new Set(state.earned);
  }

  /** Re-evaluate (celebrating new stamps) after every progress event. Wire AFTER the
   *  systems whose counters we read (QuestSystem) so their bump lands first. */
  wire(): void {
    for (const ev of TRIGGERS) {
      this.unsubs.push(bus.on(ev, () => this.evaluate(false)));
    }
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
  }

  /** Silent retroactive grant on load — the book reflects reality, no celebration spam. */
  announce(): void {
    this.evaluate(true);
  }

  private evaluate(silent: boolean): void {
    const s = this.stats();
    let changed = false;
    for (const def of ACHIEVEMENTS) {
      if (this.earned.has(def.id) || !def.check(s)) continue;
      this.earned.add(def.id);
      changed = true;
      if (!silent) {
        bus.emit('achievement:earned', { id: def.id, nameKey: def.nameKey, descKey: def.descKey, icon: def.icon });
      }
    }
    if (changed) this.state.earned = [...this.earned];
  }

  /** Read-only view for the Stamp Book UI: every stamp + earned flag + counts. */
  view(): { earned: number; total: number; list: StampView[] } {
    const list = ACHIEVEMENTS.map((d) => ({
      id: d.id,
      nameKey: d.nameKey,
      descKey: d.descKey,
      icon: d.icon,
      category: d.category,
      earned: this.earned.has(d.id),
    }));
    return { earned: this.earned.size, total: ACHIEVEMENTS.length, list };
  }

  snapshot(): SaveAchievements {
    return { earned: [...this.earned] };
  }
}
