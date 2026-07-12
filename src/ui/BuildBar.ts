/**
 * The build bar (S21): category tabs, item cards with live thumbnails, and the
 * Move/Remove tools. Pure DOM + signals; emits cmd:* events only — never
 * touches sim state directly (TECH §3 seam).
 */
import { bus, type BlockReasonUi } from '@/core/events';
import { t, type StringKey } from '@/core/strings';
import { effect } from '@/core/signals';
import { CATALOG, CATEGORIES, type Category } from '@/content/catalog';
import { signal } from '@/core/signals';
import { levelSignal, popsSignal, stardustSignal } from '@/core/playerStore';
import { tierUnlockLevel } from '@/sim/progression';
import { showToast } from './Toasts';
import {
  selectedDefSignal,
  toolSignal,
  carryingSignal,
  catalogOpenSignal,
  catalogRevealSignal,
  ghostBlockedSignal,
} from './uiState';

const TAB_KEYS: Record<Category | 'all', StringKey> = {
  all: 'build.tab.all',
  nature: 'build.tab.nature',
  decor: 'build.tab.decor',
  home: 'build.tab.home',
  income: 'build.tab.income',
  ground: 'build.tab.ground',
};

/** Ghost-invalid reason → its localized hint (S23 colour-blind cue: text, not colour). */
const BLOCK_KEY: Record<BlockReasonUi, StringKey> = {
  'off-island': 'build.blocked.island',
  occupied: 'build.blocked.occupied',
  unaffordable: 'build.blocked.afford',
  'needs-edge': 'build.blocked.edge',
};

export class BuildBar {
  private root: HTMLDivElement;
  private cardsEl: HTMLDivElement;
  private hintEl: HTMLDivElement;
  private activeTab = signal<Category | 'all'>('all');
  private thumbEls = new Map<string, HTMLElement>();

  /** Clear "New!" badges for items in a tab (called on tab click, NOT inside an
   *  effect — else a level-up that adds reveals would self-clear them, bug #2). */
  private clearRevealForTab(tab: Category | 'all'): void {
    const reveal = catalogRevealSignal.get();
    if (!reveal.size) return;
    const next = new Set(reveal);
    for (const def of CATALOG) {
      if ((tab === 'all' || def.category === tab) && next.has(def.id)) next.delete(def.id);
    }
    if (next.size !== reveal.size) catalogRevealSignal.set(next);
  }

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
      tab.addEventListener('click', () => {
        this.activeTab.set(cat);
        this.clearRevealForTab(cat); // viewing a tab clears its "New!" badges
      });
      effect(() => tab.classList.toggle('active', this.activeTab.get() === cat));
      tabs.appendChild(tab);
    }

    const tools = document.createElement('div');
    tools.className = 'build-tools';
    top.appendChild(tools);
    const toolButton = (label: string, tool: 'move' | 'remove' | 'biome', keyHint: string) => {
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
    toolButton(t('build.tool.biome'), 'biome', 'G'); // re-theme a chunk's biome

    // — cards row
    this.cardsEl = document.createElement('div');
    this.cardsEl.className = 'build-cards';
    this.root.appendChild(this.cardsEl);

    const cardEls = new Map<string, HTMLButtonElement>();
    for (const def of CATALOG) {
      const card = document.createElement('button');
      card.className = 'build-card';
      const costHtml = `<span class="card-cost">● ${def.cost}<span class="afford-flag" aria-hidden="true"> ✕</span></span>${
        def.costStardust ? `<span class="card-cost-sd">✦ ${def.costStardust}</span>` : ''
      }`;
      card.innerHTML = `
        <div class="card-thumb card-thumb-empty"></div>
        <span class="card-lock">🔒 <span class="lock-lv"></span></span>
        <span class="card-name"></span>
        <span class="card-meta"><span class="card-size">${def.footprint.w}×${def.footprint.d}</span>${costHtml}</span>`;
      (card.querySelector('.card-name') as HTMLElement).textContent = t(def.nameKey);
      (card.querySelector('.lock-lv') as HTMLElement).textContent = `L${tierUnlockLevel(def.tier)}`;
      this.thumbEls.set(def.id, card.querySelector('.card-thumb') as HTMLElement);

      card.addEventListener('click', () => {
        if (tierUnlockLevel(def.tier) > levelSignal.get()) {
          showToast(t('build.locked').replace('{level}', String(tierUnlockLevel(def.tier))));
          return;
        }
        const next = selectedDefSignal.get() === def.id ? null : def.id;
        selectedDefSignal.set(next);
        bus.emit('cmd:selectItem', { defId: next });
      });

      effect(() => card.classList.toggle('active', selectedDefSignal.get() === def.id));
      // locked until its tier's level is reached (re-runs live as the player levels)
      effect(() => card.classList.toggle('locked', tierUnlockLevel(def.tier) > levelSignal.get()));
      // dim (never block) when unaffordable
      effect(() => {
        const short = popsSignal.get() < def.cost || stardustSignal.get() < (def.costStardust ?? 0);
        card.classList.toggle('unaffordable', short);
      });
      // "New!" badge for freshly-unlocked items
      effect(() => card.classList.toggle('card-new', catalogRevealSignal.get().has(def.id)));

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

    // contextual hint pill — in place mode, a blocked ghost surfaces its reason as
    // text (S23 colour-blind cue), else the neutral how-to hint.
    effect(() => {
      const tool = toolSignal.get();
      const carrying = carryingSignal.get();
      const blocked = ghostBlockedSignal.get();
      let text = '';
      if (tool === 'place' && blocked) text = `✕ ${t(BLOCK_KEY[blocked])}`;
      else if (tool === 'place') text = t('build.hint.place');
      else if (tool === 'move') text = carrying ? t('build.hint.carrying') : t('build.hint.move');
      else if (tool === 'remove') text = t('build.hint.remove');
      else if (tool === 'biome') text = t('build.hint.biome');
      this.hintEl.textContent = text;
      this.hintEl.classList.toggle('blocked', tool === 'place' && !!blocked);
      this.hintEl.style.display = text ? '' : 'none';
    });
  }
}
