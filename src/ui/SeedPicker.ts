/**
 * Seed Picker (post-1.0): the little "plant a seed" chooser that opens when you tap an
 * empty Garden Patch. Lists every crop with its icon, name, grow time, and reward;
 * crops above your level show as greyed "Level N" locks. Picking one emits
 * `cmd:plantCrop` for that patch and closes. Centered modal (mirrors the Museum panel),
 * closes on backdrop / ✕ / Escape. Purely presentational — the sim plants + persists.
 */
import { bus } from '@/core/events';
import { t } from '@/core/strings';
import { tweens, easings } from '@/core/tween';
import { isReducedMotion } from '@/core/settingsStore';
import { CROPS } from '@/content/crops';

export class SeedPicker {
  private backdrop: HTMLDivElement;
  private panel: HTMLDivElement;
  private target: string | null = null;
  open = false;

  constructor(
    parent: HTMLElement,
    private readonly playerLevel: () => number,
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'seed-backdrop';
    this.backdrop.style.display = 'none';
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.panel = document.createElement('div');
    this.panel.className = 'seed-panel';
    this.backdrop.appendChild(this.panel);
    parent.appendChild(this.backdrop);

    // plant on a crop-button click (buttons are re-rendered each open, so delegate)
    this.panel.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.seed-card') as HTMLElement | null;
      if (btn && !btn.classList.contains('locked') && btn.dataset['crop'] && this.target) {
        bus.emit('cmd:plantCrop', { placementId: this.target, crop: btn.dataset['crop'] });
        this.close();
      }
    });
  }

  openFor(placementId: string): void {
    this.target = placementId;
    this.open = true;
    this.backdrop.style.display = '';
    this.render();
    if (!isReducedMotion()) {
      tweens.start({
        duration: 0.3,
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
    this.target = null;
    this.backdrop.style.display = 'none';
    this.panel.style.transform = '';
    this.panel.style.opacity = '';
  }

  private render(): void {
    const level = this.playerLevel();
    const cards = CROPS.map((c) => {
      const locked = level < c.minLevel;
      const secs = Math.round(c.growMs / 1000);
      const reward =
        `+${c.reward.pops} ●` + (c.reward.stardust ? ` +${c.reward.stardust} ✦` : '');
      if (locked) {
        return (
          `<div class="seed-card locked"><span class="seed-icon">${c.icon}</span>` +
          `<span class="seed-name">${t(c.nameKey)}</span>` +
          `<span class="seed-lock">🔒 ${t('garden.locked').replace('{n}', String(c.minLevel))}</span></div>`
        );
      }
      return (
        `<button class="seed-card" data-crop="${c.id}"><span class="seed-icon">${c.icon}</span>` +
        `<span class="seed-name">${t(c.nameKey)}</span>` +
        `<span class="seed-meta">${t('garden.grewtime').replace('{s}', String(secs))} · ${reward}</span></button>`
      );
    }).join('');
    this.panel.innerHTML = `
      <button class="seed-close" aria-label="✕">✕</button>
      <h2>${t('garden.plant')}</h2>
      <div class="seed-grid">${cards}</div>`;
    this.panel.querySelector('.seed-close')?.addEventListener('click', () => this.close());
  }
}
