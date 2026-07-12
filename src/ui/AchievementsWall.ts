/**
 * Stamp Book (post-1.0): a cozy wall of collectible achievement stamps. A 🎖️ button
 * (or `K`) opens a grid — earned stamps show their colourful icon + name, the rest are
 * greyed 🔒 silhouettes with a hint of what to aim for, under a "X / N stamps" header.
 * Read-only; pulls a fresh snapshot on open (mirrors the Album / Fish Journal).
 *
 * It also self-wires to `achievement:earned` and pops a celebratory toast whenever a new
 * stamp is earned (even while the book is closed), and re-renders if it's open. Text via
 * the string table; reduced-motion collapses the toast animation.
 */
import { bus } from '@/core/events';
import { t } from '@/core/strings';
import type { StringKey } from '@/core/strings';
import { tip, attr } from '@/ui/Tooltip';
import { tweens, easings } from '@/core/tween';
import { isReducedMotion } from '@/core/settingsStore';

interface Stamp {
  id: string;
  nameKey: StringKey;
  descKey: StringKey;
  icon: string;
  category: string;
  earned: boolean;
}
export interface StampBookData {
  earned: number;
  total: number;
  list: Stamp[];
}

export class AchievementsWall {
  private root: HTMLDivElement;
  private panel: HTMLDivElement;
  /** The top-level UI root — the earned toast escapes here so a transformed dock
   *  ancestor never breaks its position:fixed centering. */
  private readonly uiRoot: HTMLElement;
  open = false;

  constructor(
    private readonly parent: HTMLElement,
    private readonly data: () => StampBookData,
  ) {
    this.uiRoot = (parent.closest('#ui') as HTMLElement | null) ?? parent;
    this.root = document.createElement('div');
    this.root.className = 'stamps-root';
    parent.appendChild(this.root);

    const btn = document.createElement('button');
    btn.className = 'stamps-btn';
    btn.setAttribute('aria-label', t('achievements.title'));
    tip(btn, t('achievements.title'));
    btn.textContent = '🎖️';
    btn.addEventListener('click', () => this.toggle());
    this.root.appendChild(btn);

    this.panel = document.createElement('div');
    this.panel.className = 'stamps-panel';
    this.panel.style.display = 'none';
    this.root.appendChild(this.panel);

    bus.on('achievement:earned', (e) => {
      this.celebrate(e.icon, t(e.nameKey));
      if (this.open) this.render();
    });
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.panel.style.display = this.open ? '' : 'none';
    if (this.open) this.render();
  }

  private render(): void {
    const d = this.data();
    const cells = d.list
      .map((s) => {
        if (s.earned) {
          return (
            `<li class="stamp earned cat-${s.category}" data-tip="${attr(t(s.descKey))}">` +
            `<span class="stamp-icon">${s.icon}</span><span class="stamp-name">${t(s.nameKey)}</span></li>`
          );
        }
        return (
          `<li class="stamp locked" data-tip="${attr(t(s.descKey))}">` +
          `<span class="stamp-icon">🔒</span><span class="stamp-name">${t(s.nameKey)}</span></li>`
        );
      })
      .join('');
    this.panel.innerHTML = `
      <h2>${t('achievements.title')}</h2>
      <div class="stamps-summary">${d.earned} / ${d.total} ${t('achievements.progress')}</div>
      <ul class="stamps-grid">${cells}</ul>
      ${d.earned === 0 ? `<div class="stamps-hint">${t('achievements.hint')}</div>` : ''}`;
  }

  /** A celebratory "Stamp earned!" toast that pops in and floats up (viewport-centred). */
  private celebrate(icon: string, name: string): void {
    const card = document.createElement('div');
    card.className = 'stamp-toast';
    card.innerHTML =
      `<span class="st-icon">${icon}</span>` +
      `<span class="st-label">${t('achievements.earned')}</span>` +
      `<span class="st-name">${name}</span>`;
    // stack multiple simultaneous earns (e.g. Builder + Home Sweet Home) instead of overlapping
    const stacked = this.uiRoot.querySelectorAll('.stamp-toast').length;
    card.style.top = `calc(28% + ${stacked * 82}px)`;
    // append to the top-level #ui (not the dock/root) so position:fixed centres on the viewport
    this.uiRoot.appendChild(card);

    const remove = (): void => card.remove();
    if (isReducedMotion()) {
      window.setTimeout(remove, 2600);
      return;
    }
    tweens.start({
      duration: 2.8,
      ease: easings.cubicOut,
      onUpdate: (tt) => {
        const pop = tt < 0.14 ? easings.backOut(tt / 0.14) : 1;
        const rise = tt > 0.72 ? (tt - 0.72) / 0.28 : 0;
        card.style.transform = `translate(-50%, ${-rise * 40}px) scale(${pop})`;
        card.style.opacity = tt > 0.72 ? String(1 - rise) : '1';
      },
      onComplete: remove,
    });
  }
}
