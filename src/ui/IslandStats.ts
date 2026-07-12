/**
 * Island stats strip (UI rework): a glanceable bottom-left chip row surfacing the
 * island's living state — neighbours, Pals, chunks, crops growing, stamps earned — so
 * the diorama's life is always visible (part of making the HUD feel less empty). Pure
 * DOM; re-rendered event-driven (not per-frame, so no steady-state allocation) whenever
 * one of the counts could have changed. Text/counts via injected provider.
 */
import { bus } from '@/core/events';
import { t, type StringKey } from '@/core/strings';

export interface IslandStatsData {
  neighbours: number;
  pals: number;
  chunks: number;
  crops: number;
  stamps: number;
}

const CHIPS: ReadonlyArray<{ key: keyof IslandStatsData; icon: string; titleKey: StringKey }> = [
  { key: 'neighbours', icon: '🧑', titleKey: 'stats.neighbours' },
  { key: 'pals', icon: '🐾', titleKey: 'stats.pals' },
  { key: 'chunks', icon: '🧭', titleKey: 'stats.chunks' },
  { key: 'crops', icon: '🌱', titleKey: 'stats.crops' },
  { key: 'stamps', icon: '🎖️', titleKey: 'stats.stamps' },
];

// events after which a count might have changed (re-render on any of them)
const TRIGGERS = [
  'item:placed',
  'item:removed',
  'npc:arrived',
  'pal:adopted',
  'chunk:unlocked',
  'garden:planted',
  'garden:harvested',
  'achievement:earned',
] as const;

export class IslandStats {
  private root: HTMLDivElement;
  private last = '';

  constructor(
    parent: HTMLElement,
    private readonly data: () => IslandStatsData,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'island-stats';
    parent.appendChild(this.root);
    for (const ev of TRIGGERS) bus.on(ev, () => this.render());
    this.render();
  }

  /** Re-render if any count changed (diffed via a composite key). */
  render(): void {
    const d = this.data();
    const key = CHIPS.map((c) => d[c.key]).join(',');
    if (key === this.last) return;
    this.last = key;
    this.root.innerHTML = CHIPS.map(
      (c) =>
        `<div class="istat" title="${t(c.titleKey)}"><span class="istat-icon">${c.icon}</span><span class="istat-n">${d[c.key]}</span></div>`,
    ).join('');
  }
}
