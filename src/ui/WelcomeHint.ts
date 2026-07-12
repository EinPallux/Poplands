/**
 * Empty-island welcome hint (post-1.0, user 2026-07-12): a friendly one-time coach-mark
 * for brand-new players. Since a fresh island is now a fully blank canvas, this points at
 * the build bar so the first tap is obvious — directly answering "it's easy to feel lost".
 *
 * Strictly no-FOMO: it only appears when the player has never placed anything
 * (`itemsPlaced === 0` at boot) and quietly retires the moment they place their first
 * item. Returning players never see it. Pure DOM + one event subscription; reduced-motion
 * skips the float animation.
 */
import { bus } from '@/core/events';
import { t } from '@/core/strings';

export class WelcomeHint {
  private root: HTMLDivElement | null = null;
  private off: (() => void) | null = null;

  /** @param neverBuilt true when the island has had nothing placed ever (fresh player). */
  constructor(parent: HTMLElement, neverBuilt: boolean) {
    if (!neverBuilt) return; // returning players skip it entirely

    this.root = document.createElement('div');
    this.root.className = 'welcome-hint';
    this.root.innerHTML =
      `<div class="wh-card">` +
      `<div class="wh-title">${t('welcome.title')}</div>` +
      `<div class="wh-body">${t('welcome.body')}</div>` +
      `<button class="wh-dismiss">${t('welcome.dismiss')}</button>` +
      `</div><div class="wh-arrow">▾</div>`;
    parent.appendChild(this.root);

    this.root.querySelector('.wh-dismiss')?.addEventListener('click', () => this.dismiss());
    // retire the instant they place their first thing (the hint has served its purpose)
    this.off = bus.on('item:placed', () => this.dismiss());
  }

  private dismiss(): void {
    this.off?.();
    this.off = null;
    if (!this.root) return;
    this.root.classList.add('gone');
    const el = this.root;
    this.root = null;
    setTimeout(() => el.remove(), 400);
  }
}
