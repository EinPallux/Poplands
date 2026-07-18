/**
 * Island Album (S21, v0.6): a cozy scrapbook that surfaces the lifetime milestone
 * counters and the little community that's grown — who's moved in, which Pals visit.
 * Read-only; pulls a fresh snapshot each time it opens. Text via the string table.
 */
import { t, type StringKey } from '@/core/strings';
import { tip } from '@/ui/Tooltip';
import { MILESTONES } from '@/content/quests';
import { islanderDef, friendPairs } from '@/content/roster';
import { palDef } from '@/content/pals';
import { THEME_EMOJI } from '@/content/themes';
import type { CounterId } from '@/core/save';
import type { ChunkTheme } from '@/core/grid';

export interface AlbumData {
  milestones: Record<CounterId, number>;
  residents: string[];
  pals: string[];
  themes: ChunkTheme[];
  /** Island mood (post-1.0 happiness) — an emoji + a mood-word string key. */
  mood: { emoji: string; moodKey: StringKey };
}

export class Album {
  private root: HTMLDivElement;
  private panel: HTMLDivElement;
  open = false;

  constructor(
    parent: HTMLElement,
    private readonly data: () => AlbumData,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'album-root';
    parent.appendChild(this.root);

    const btn = document.createElement('button');
    btn.className = 'album-btn';
    btn.setAttribute('aria-label', t('album.title'));
    tip(btn, t('album.title')); // visible hover label (custom tooltip)
    btn.textContent = '📖';
    btn.addEventListener('click', () => this.toggle());
    this.root.appendChild(btn);

    this.panel = document.createElement('div');
    this.panel.className = 'album-panel';
    this.panel.style.display = 'none';
    this.root.appendChild(this.panel);
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.panel.style.display = this.open ? '' : 'none';
    if (this.open) this.render();
  }

  private render(): void {
    const d = this.data();
    const ms = MILESTONES.map((m) => {
      const val = d.milestones[m.counter] ?? 0;
      const next = m.tiers.find((tr) => val < tr.at);
      const goal = next ? `${val} / ${next.at}` : `${val} ✓`;
      return `<li><span>${t(m.labelKey)}</span><b>${goal}</b></li>`;
    }).join('');

    const people = d.residents
      .map((id) => {
        const def = islanderDef(id);
        return def ? `<span class="album-chip">🙂 ${t(def.nameKey)}</span>` : '';
      })
      .join('');
    const pals = d.pals
      .map((id) => {
        const def = palDef(id);
        return def ? `<span class="album-chip">${def.icon} ${t(def.nameKey)}</span>` : '';
      })
      .join('');

    // best-friend pairs among the residents who've moved in (post-1.0)
    const friends = friendPairs(d.residents)
      .map((p) => {
        const a = islanderDef(p.a);
        const b = islanderDef(p.b);
        return a && b ? `<span class="album-chip">💛 ${t(a.nameKey)} &amp; ${t(b.nameKey)}</span>` : '';
      })
      .join('');

    // biome tally across the island
    const counts = new Map<ChunkTheme, number>();
    for (const th of d.themes) counts.set(th, (counts.get(th) ?? 0) + 1);
    const biomes = [...counts.entries()]
      .map(([th, n]) => `<span class="album-chip">${THEME_EMOJI[th]} ${n}</span>`)
      .join('');

    this.panel.innerHTML = `
      <h2>${t('album.title')}</h2>
      ${d.residents.length > 0 ? `<div class="album-mood">${d.mood.emoji} ${t('rating.mood')} <b>${t(d.mood.moodKey)}</b></div>` : ''}
      <h3>${t('album.milestones')}</h3>
      <ul class="album-ms">${ms}</ul>
      <h3>${t('album.neighbours')}</h3>
      <div class="album-chips">${people || `<span class="album-empty">${t('album.empty')}</span>`}</div>
      ${friends ? `<h3>${t('album.friends')}</h3><div class="album-chips">${friends}</div>` : ''}
      <h3>${t('album.pals')}</h3>
      <div class="album-chips">${pals || `<span class="album-empty">${t('album.empty')}</span>`}</div>
      <h3>${t('album.biomes')}</h3>
      <div class="album-chips">${biomes}</div>`;
  }
}
