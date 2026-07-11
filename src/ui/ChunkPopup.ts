/**
 * The chunk-arrival celebration popup (S21): a cute, non-modal banner that springs
 * in when a new chunk is called and auto-dismisses. Frames the arrival set piece
 * without blocking play (GDD §11.3 — nothing modal during play). Reduced-motion
 * gets a plain fade (no bounce), decided here.
 */
import { bus } from '@/core/events';
import { t } from '@/core/strings';
import { isReducedMotion } from '@/core/settingsStore';

const HOLD_MS = 2800;

export class ChunkPopup {
  private root: HTMLDivElement;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'chunk-popup';
    this.root.setAttribute('role', 'status');
    parent.appendChild(this.root);
    bus.on('chunk:unlocked', (e) => this.show(e.index));
  }

  private show(index: number): void {
    this.root.innerHTML =
      `<span class="chunk-popup-emoji">🎉</span>` +
      `<span class="chunk-popup-title">${t('chunk.popup.title')}</span>` +
      `<span class="chunk-popup-sub">${t('chunk.popup.sub').replace('{n}', String(index))}</span>`;
    this.root.classList.toggle('reduced', isReducedMotion());
    this.root.classList.add('show');
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.root.classList.remove('show'), HOLD_MS);
  }
}
