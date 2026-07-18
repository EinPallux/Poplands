/**
 * Island Charm panel (post-1.0, user 2026-07-12): a cozy ⭐ star rating for your island
 * with a per-axis breakdown and gentle "what to add next" tips. A retention nudge that
 * doubles as the cure for feeling lost — it always suggests a concrete, cheerful next
 * step. Read-only; pulls a fresh snapshot each open (mirrors the Island Album). A dock
 * button opens a flyout panel; the score is derived, never persisted.
 */
import { t } from '@/core/strings';
import { tip } from '@/ui/Tooltip';
import { computeRating, type RatingSnapshot } from '@/content/rating';

export class RatingPanel {
  private root: HTMLDivElement;
  private panel: HTMLDivElement;
  open = false;

  constructor(
    parent: HTMLElement,
    private readonly snapshot: () => RatingSnapshot,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'rating-root';
    parent.appendChild(this.root);

    const btn = document.createElement('button');
    btn.className = 'rating-btn';
    btn.setAttribute('aria-label', t('rating.title'));
    tip(btn, t('rating.title'));
    btn.textContent = '⭐';
    btn.addEventListener('click', () => this.toggle());
    this.root.appendChild(btn);

    this.panel = document.createElement('div');
    this.panel.className = 'rating-panel';
    this.panel.style.display = 'none';
    this.root.appendChild(this.panel);
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.panel.style.display = this.open ? '' : 'none';
    if (this.open) this.render();
  }

  private render(): void {
    const r = computeRating(this.snapshot());
    const pct = Math.round((r.stars / 5) * 100);
    const bars = r.categories
      .map(
        (c) =>
          `<div class="rating-axis"><span class="ra-label">${t(c.labelKey)}</span>` +
          `<span class="ra-bar"><span class="ra-fill" style="width:${Math.round(c.fraction * 100)}%"></span></span></div>`,
      )
      .join('');
    const tips = r.tips.map((tp) => `<li>${t(tp.tipKey)}</li>`).join('');
    this.panel.innerHTML = `
      <h2>${t('rating.title')}</h2>
      <div class="rating-score">
        <div class="rating-stars" aria-label="${r.stars} ${t('rating.outOf')}">
          <div class="rs-base">★★★★★</div>
          <div class="rs-fill" style="width:${pct}%">★★★★★</div>
        </div>
        <div class="rating-num">${r.stars} <span class="rating-of">${t('rating.outOf')}</span></div>
      </div>
      <div class="rating-verdict">${t(r.verdictKey)}</div>
      <div class="rating-mood">${r.happiness.emoji} ${t('rating.mood')} <b>${t(r.happiness.moodKey)}</b></div>
      <div class="rating-breakdown">${bars}</div>
      <div class="rating-tips">
        <div class="rt-head">${t('rating.tipsHead')}</div>
        <ul>${tips}</ul>
      </div>`;
  }
}
