/**
 * Island Album (S21, v0.6): a cozy scrapbook that surfaces the lifetime milestone
 * counters and the little community that's grown — who's moved in, which Pals visit.
 * Read-only; pulls a fresh snapshot each time it opens. Text via the string table.
 */
import { t } from '@/core/strings';
import { MILESTONES } from '@/content/quests';
import { islanderDef } from '@/content/roster';
import { palDef } from '@/content/pals';
import { THEME_EMOJI } from '@/content/themes';
import type { CounterId } from '@/core/save';
import type { ChunkTheme } from '@/core/grid';

export interface AlbumData {
  milestones: Record<CounterId, number>;
  residents: string[];
  pals: string[];
  themes: ChunkTheme[];
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
        return def ? `<span class="album-chip">🐾 ${t(def.nameKey)}</span>` : '';
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
      <h3>${t('album.milestones')}</h3>
      <ul class="album-ms">${ms}</ul>
      <h3>${t('album.neighbours')}</h3>
      <div class="album-chips">${people || `<span class="album-empty">${t('album.empty')}</span>`}</div>
      <h3>${t('album.pals')}</h3>
      <div class="album-chips">${pals || `<span class="album-empty">${t('album.empty')}</span>`}</div>
      <h3>${t('album.biomes')}</h3>
      <div class="album-chips">${biomes}</div>`;
  }
}
