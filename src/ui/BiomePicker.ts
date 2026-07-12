/**
 * Biome Picker (post-1.0, user 2026-07-12): the "change this chunk's biome" chooser that
 * opens when you tap a chunk with the Biome tool. Shows the four biomes (Meadow / Sandbar /
 * Spooky / Snowcap) with a colour swatch + emoji + name; the chunk's current biome is
 * marked. Picking one emits `cmd:reThemeChunk` for that chunk and closes — free & instant
 * (no cost, no-grind; redecorate as you like). Centered modal mirroring the Seed Picker;
 * closes on backdrop / ✕ / Escape. Purely presentational — the sim re-themes + persists.
 */
import { bus } from '@/core/events';
import { t } from '@/core/strings';
import { tweens, easings } from '@/core/tween';
import { isReducedMotion } from '@/core/settingsStore';
import { THEMES, THEME_EMOJI } from '@/content/themes';
import type { ChunkTheme } from '@/core/grid';

const ORDER: ChunkTheme[] = ['meadow', 'sandbar', 'spooky', 'snowcap'];
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export class BiomePicker {
  private backdrop: HTMLDivElement;
  private panel: HTMLDivElement;
  private target: { cx: number; cz: number } | null = null;
  open = false;

  constructor(
    parent: HTMLElement,
    private readonly themeOf: (cx: number, cz: number) => ChunkTheme,
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'biome-backdrop';
    this.backdrop.style.display = 'none';
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.panel = document.createElement('div');
    this.panel.className = 'biome-panel';
    this.backdrop.appendChild(this.panel);
    parent.appendChild(this.backdrop);

    // re-theme on a biome-card click (cards re-render each open, so delegate)
    this.panel.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.biome-card') as HTMLElement | null;
      const theme = btn?.dataset['theme'] as ChunkTheme | undefined;
      if (theme && this.target) {
        bus.emit('cmd:reThemeChunk', { cx: this.target.cx, cz: this.target.cz, theme });
        this.close();
      }
    });

    bus.on('cmd:openBiomePicker', (e) => this.openFor(e.cx, e.cz));
  }

  openFor(cx: number, cz: number): void {
    this.target = { cx, cz };
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
    const current = this.target ? this.themeOf(this.target.cx, this.target.cz) : 'meadow';
    const cards = ORDER.map((th) => {
      const p = THEMES[th];
      const active = th === current ? ' active' : '';
      const swatch = `background: linear-gradient(135deg, ${hex(p.grassLight)}, ${hex(p.grassTop)} 60%, ${hex(p.rockShoulder)});`;
      return (
        `<button class="biome-card${active}" data-theme="${th}">` +
        `<span class="biome-swatch" style="${swatch}"></span>` +
        `<span class="biome-emoji">${THEME_EMOJI[th]}</span>` +
        `<span class="biome-name">${t(`theme.${th}`)}</span>` +
        (active ? `<span class="biome-current">${t('biome.current')}</span>` : '') +
        `</button>`
      );
    }).join('');
    this.panel.innerHTML = `
      <button class="biome-close" aria-label="✕">✕</button>
      <h2>${t('biome.title')}</h2>
      <div class="biome-sub">${t('biome.sub')}</div>
      <div class="biome-grid">${cards}</div>`;
    this.panel.querySelector('.biome-close')?.addEventListener('click', () => this.close());
  }
}
