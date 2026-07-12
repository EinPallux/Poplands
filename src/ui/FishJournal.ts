/**
 * Fish Journal (post-1.0): a cozy scrapbook of what you've reeled in — every
 * species listed, caught ones showing icon + name + rarity + count, the rest as
 * locked "❓" silhouettes to tease. Read-only; pulls a fresh snapshot each open.
 * Mirrors the Island Album. Text via the string table.
 */
import { t } from '@/core/strings';
import { tip } from '@/ui/Tooltip';
import { FISH } from '@/content/fish';

export interface JournalData {
  caught: Record<string, number>;
  total: number;
  species: number;
}

export class FishJournal {
  private root: HTMLDivElement;
  private panel: HTMLDivElement;
  open = false;

  constructor(
    parent: HTMLElement,
    private readonly data: () => JournalData,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'journal-root';
    parent.appendChild(this.root);

    const btn = document.createElement('button');
    btn.className = 'journal-btn';
    btn.setAttribute('aria-label', t('journal.title'));
    tip(btn, t('journal.title'));
    btn.textContent = '🎣';
    btn.addEventListener('click', () => this.toggle());
    this.root.appendChild(btn);

    this.panel = document.createElement('div');
    this.panel.className = 'journal-panel';
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
    const rows = FISH.map((f) => {
      const n = d.caught[f.id] ?? 0;
      if (n > 0) {
        return (
          `<li class="jf caught rarity-${f.rarity}"><span class="jf-icon">${f.icon}</span>` +
          `<span class="jf-name">${t(f.nameKey)}</span>` +
          `<span class="jf-badge">${t(`journal.rarity.${f.rarity}`)}</span>` +
          `<span class="jf-count">×${n}</span></li>`
        );
      }
      return `<li class="jf locked"><span class="jf-icon">❓</span><span class="jf-name">${t('journal.locked')}</span></li>`;
    }).join('');

    this.panel.innerHTML = `
      <h2>${t('journal.title')}</h2>
      <div class="journal-summary">${d.species} / ${FISH.length} ${t('journal.progress')} · ${d.total} ${t('journal.catches')}</div>
      <ul class="journal-list">${rows}</ul>
      ${d.total === 0 ? `<div class="journal-hint">${t('journal.hint')}</div>` : ''}`;
  }
}
