/**
 * Collections Hall panel (post-1.0): opens when the player taps a placed Collections
 * Hall (via `cmd:openMuseum`, not a corner toggle — it's building-gated). Shows the
 * Fish Hall: every species as an on-display plaque, a "Donate" button if it's caught
 * but not yet given, or a locked silhouette if it hasn't been reeled in. A little
 * overview line celebrates secrets found + neighbours who've moved in.
 *
 * Purely presentational: donating emits `cmd:donate` (the sim donates, the economy
 * credits the reward); the panel self-wires to `museum:donated`/`museum:completed`
 * to re-render and play a cozy thank-you / hall-complete moment. Text via the table.
 */
import { bus } from '@/core/events';
import { t } from '@/core/strings';
import type { StringKey } from '@/core/strings';
import { tweens, easings } from '@/core/tween';
import { isReducedMotion } from '@/core/settingsStore';

type DisplayState = 'display' | 'catchable' | 'locked';

export interface MuseumPanelData {
  fish: Array<{ id: string; nameKey: StringKey; icon: string; rarity: string; state: DisplayState }>;
  donatedCount: number;
  total: number;
  secretsFound: number;
  neighbours: number;
}

export class MuseumPanel {
  private backdrop: HTMLDivElement;
  private panel: HTMLDivElement;
  open = false;

  constructor(
    private readonly parent: HTMLElement,
    private readonly data: () => MuseumPanelData,
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'museum-backdrop';
    this.backdrop.style.display = 'none';
    // click the dim backdrop (outside the panel) to close
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.panel = document.createElement('div');
    this.panel.className = 'museum-panel';
    this.backdrop.appendChild(this.panel);
    parent.appendChild(this.backdrop);

    // donate buttons are re-rendered each open, so delegate the click on the panel
    this.panel.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.mu-donate') as HTMLElement | null;
      if (btn?.dataset['species']) bus.emit('cmd:donate', { species: btn.dataset['species'] });
    });

    bus.on('museum:donated', (ev) => {
      if (this.open) {
        this.render();
        this.thanks(`${ev.icon} ${t(ev.nameKey)}`);
      }
    });
    bus.on('museum:completed', () => {
      if (this.open) this.complete();
    });
  }

  toggle(): void {
    if (this.open) this.close();
    else this.openPanel();
  }

  openPanel(): void {
    this.open = true;
    this.backdrop.style.display = '';
    this.render();
    if (!isReducedMotion()) {
      tweens.start({
        duration: 0.32,
        ease: easings.backOut,
        onUpdate: (tt) => {
          this.panel.style.transform = `scale(${0.9 + 0.1 * tt})`;
          this.panel.style.opacity = String(tt);
        },
      });
    }
  }

  close(): void {
    this.open = false;
    this.backdrop.style.display = 'none';
    this.panel.style.transform = '';
    this.panel.style.opacity = '';
  }

  private render(): void {
    const d = this.data();
    const rows = d.fish
      .map((f) => {
        if (f.state === 'display') {
          return (
            `<li class="mu rarity-${f.rarity} display"><span class="mu-icon">${f.icon}</span>` +
            `<span class="mu-name">${t(f.nameKey)}</span>` +
            `<span class="mu-tag">${t('museum.onDisplay')}</span></li>`
          );
        }
        if (f.state === 'catchable') {
          return (
            `<li class="mu rarity-${f.rarity} catchable"><span class="mu-icon">${f.icon}</span>` +
            `<span class="mu-name">${t(f.nameKey)}</span>` +
            `<button class="mu-donate" data-species="${f.id}">${t('museum.donate')}</button></li>`
          );
        }
        return (
          `<li class="mu locked"><span class="mu-icon">❓</span>` +
          `<span class="mu-name">${t('museum.locked')}</span></li>`
        );
      })
      .join('');

    const complete = d.donatedCount === d.total && d.total > 0;
    this.panel.innerHTML = `
      <button class="museum-close" aria-label="✕">✕</button>
      <h2>${t('museum.title')}</h2>
      <div class="museum-sub">${t('museum.fishHall')} — ${d.donatedCount} / ${d.total} ${t('museum.progress')}</div>
      <div class="museum-overview">${t('museum.overview').replace('{s}', String(d.secretsFound)).replace('{n}', String(d.neighbours))}</div>
      <ul class="museum-list">${rows}</ul>
      ${complete ? `<div class="museum-done">${t('museum.complete')}</div>` : `<div class="museum-hint">${t('museum.hint')}</div>`}`;
    const x = this.panel.querySelector('.museum-close');
    x?.addEventListener('click', () => this.close());
  }

  /** A brief "{fish} is on display now" toast that floats up over the panel. */
  private thanks(fish: string): void {
    const toast = document.createElement('div');
    toast.className = 'museum-toast';
    toast.textContent = t('museum.thanks').replace('{fish}', fish);
    this.panel.appendChild(toast);
    const remove = (): void => toast.remove();
    if (isReducedMotion()) {
      window.setTimeout(remove, 1800);
      return;
    }
    tweens.start({
      duration: 1.8,
      ease: easings.cubicOut,
      onUpdate: (tt) => {
        const pop = tt < 0.2 ? easings.backOut(tt / 0.2) : 1;
        const rise = tt > 0.6 ? (tt - 0.6) / 0.4 : 0;
        toast.style.transform = `translate(-50%, ${-rise * 26}px) scale(${pop})`;
        toast.style.opacity = tt > 0.6 ? String(1 - rise) : '1';
      },
      onComplete: remove,
    });
  }

  /** Hall-complete flourish: a big cheer overlay that fades after a beat. */
  private complete(): void {
    const cheer = document.createElement('div');
    cheer.className = 'museum-cheer';
    cheer.textContent = '✨🏛️✨';
    this.panel.appendChild(cheer);
    const remove = (): void => cheer.remove();
    if (isReducedMotion()) {
      window.setTimeout(remove, 2200);
      return;
    }
    tweens.start({
      duration: 2.2,
      ease: easings.cubicOut,
      onUpdate: (tt) => {
        const pop = tt < 0.24 ? easings.backOut(tt / 0.24) : 1;
        cheer.style.transform = `translate(-50%, -50%) scale(${pop * (1 + tt * 0.4)})`;
        cheer.style.opacity = tt > 0.7 ? String(1 - (tt - 0.7) / 0.3) : '1';
      },
      onComplete: remove,
    });
  }
}
