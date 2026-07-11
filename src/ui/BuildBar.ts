/**
 * The build bar (S21): category tabs, item cards with live thumbnails, and the
 * Move/Remove tools. Pure DOM + signals; emits cmd:* events only — never
 * touches sim state directly (TECH §3 seam).
 */
import { bus } from '@/core/events';
import { t, type StringKey } from '@/core/strings';
import { effect } from '@/core/signals';
import { CATALOG, CATEGORIES, type Category } from '@/content/catalog';
import { signal } from '@/core/signals';
import { selectedDefSignal, toolSignal, carryingSignal, catalogOpenSignal } from './uiState';

const TAB_KEYS: Record<Category | 'all', StringKey> = {
  all: 'build.tab.all',
  nature: 'build.tab.nature',
  decor: 'build.tab.decor',
  home: 'build.tab.home',
  income: 'build.tab.income',
  ground: 'build.tab.ground',
};

export class BuildBar {
  private root: HTMLDivElement;
  private cardsEl: HTMLDivElement;
  private hintEl: HTMLDivElement;
  private activeTab = signal<Category | 'all'>('all');
  private thumbEls = new Map<string, HTMLElement>();

  /** Thumbnails render after boot (they're expensive on slow GPUs) — patch in. */
  setThumbnails(thumbnails: Map<string, string>): void {
    for (const [id, holder] of this.thumbEls) {
      const src = thumbnails.get(id);
      if (!src) continue;
      const img = document.createElement('img');
      img.className = 'card-thumb';
      img.src = src;
      img.alt = '';
      img.draggable = false;
      holder.replaceWith(img);
    }
    this.thumbEls.clear();
  }

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'buildbar';
    parent.appendChild(this.root);

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'build-hint';
    parent.appendChild(this.hintEl);

    // — tabs + tools row
    const top = document.createElement('div');
    top.className = 'buildbar-top';
    this.root.appendChild(top);

    const tabs = document.createElement('div');
    tabs.className = 'build-tabs';
    top.appendChild(tabs);
    for (const cat of ['all', ...CATEGORIES] as const) {
      const tab = document.createElement('button');
      tab.className = 'build-tab';
      tab.textContent = t(TAB_KEYS[cat]);
      tab.addEventListener('click', () => this.activeTab.set(cat));
      effect(() => tab.classList.toggle('active', this.activeTab.get() === cat));
      tabs.appendChild(tab);
    }

    const tools = document.createElement('div');
    tools.className = 'build-tools';
    top.appendChild(tools);
    const toolButton = (label: string, tool: 'move' | 'remove', keyHint: string) => {
      const btn = document.createElement('button');
      btn.className = `build-tool tool-${tool}`;
      btn.innerHTML = `${label} <kbd>${keyHint}</kbd>`;
      btn.addEventListener('click', () => {
        bus.emit('cmd:setTool', { tool: toolSignal.get() === tool ? 'none' : tool });
      });
      effect(() => btn.classList.toggle('active', toolSignal.get() === tool));
      tools.appendChild(btn);
    };
    toolButton(t('build.tool.move'), 'move', 'M');
    toolButton(t('build.tool.remove'), 'remove', 'X');

    // — cards row
    this.cardsEl = document.createElement('div');
    this.cardsEl.className = 'build-cards';
    this.root.appendChild(this.cardsEl);

    const cardEls = new Map<string, HTMLButtonElement>();
    for (const def of CATALOG) {
      const card = document.createElement('button');
      card.className = 'build-card';
      card.innerHTML = `
        <div class="card-thumb card-thumb-empty"></div>
        <span class="card-name"></span>
        <span class="card-meta"><span class="card-size">${def.footprint.w}×${def.footprint.d}</span><span class="card-cost">● ${def.cost}</span></span>`;
      (card.querySelector('.card-name') as HTMLElement).textContent = t(def.nameKey);
      this.thumbEls.set(def.id, card.querySelector('.card-thumb') as HTMLElement);
      card.addEventListener('click', () => {
        const next = selectedDefSignal.get() === def.id ? null : def.id;
        selectedDefSignal.set(next);
        bus.emit('cmd:selectItem', { defId: next });
      });
      effect(() => card.classList.toggle('active', selectedDefSignal.get() === def.id));
      cardEls.set(def.id, card);
      this.cardsEl.appendChild(card);
    }

    // tab filtering with a staggered entrance cascade (ART §7.1.4 — cascade,
    // don't sync). Visible cards re-trigger their pop-in animation with a small
    // per-card delay so switching tabs feels alive, not a static show/hide.
    let firstFilter = true;
    effect(() => {
      const tab = this.activeTab.get();
      let visibleIndex = 0;
      for (const def of CATALOG) {
        const el = cardEls.get(def.id);
        if (!el) continue;
        const visible = tab === 'all' || def.category === tab;
        if (!visible) {
          el.style.display = 'none';
          el.classList.remove('card-enter');
          continue;
        }
        el.style.display = '';
        // restart the CSS entrance animation (force reflow so it replays)
        el.classList.remove('card-enter');
        void el.offsetWidth;
        el.style.animationDelay = `${visibleIndex * 24}ms`;
        el.classList.add('card-enter');
        visibleIndex++;
      }
      if (!firstFilter) this.cardsEl.scrollLeft = 0; // reset scroll when switching tabs
      firstFilter = false;
    });

    // collapse toggle (B)
    effect(() => {
      this.root.classList.toggle('collapsed', !catalogOpenSignal.get());
    });

    // contextual hint pill
    effect(() => {
      const tool = toolSignal.get();
      const carrying = carryingSignal.get();
      let text = '';
      if (tool === 'place') text = t('build.hint.place');
      else if (tool === 'move') text = carrying ? t('build.hint.carrying') : t('build.hint.move');
      else if (tool === 'remove') text = t('build.hint.remove');
      this.hintEl.textContent = text;
      this.hintEl.style.display = text ? '' : 'none';
    });
  }
}
