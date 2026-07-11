/**
 * Boot loading overlay (F3 flow): sky-gradient backdrop, title, honest progress,
 * controls hint. Fades away as the camera swoops in. Also the error card.
 * All strings via t() — never hardcoded (i18n decision).
 */
import { t } from '@/core/strings';
import { bus } from '@/core/events';

export class LoadingScreen {
  private root: HTMLDivElement;
  private bar: HTMLDivElement;
  private offProgress: () => void;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'loading';
    this.root.innerHTML = `
      <div class="loading-card">
        <h1 class="loading-title"></h1>
        <p class="loading-tagline"></p>
        <div class="loading-track"><div class="loading-bar"></div></div>
        <p class="loading-hint"></p>
      </div>`;
    (this.root.querySelector('.loading-title') as HTMLElement).textContent = t('app.title');
    (this.root.querySelector('.loading-tagline') as HTMLElement).textContent = t('loading.label');
    (this.root.querySelector('.loading-hint') as HTMLElement).textContent = t('loading.hint');
    this.bar = this.root.querySelector('.loading-bar') as HTMLDivElement;
    parent.appendChild(this.root);

    this.offProgress = bus.on('assets:progress', ({ progress }) => {
      this.bar.style.width = `${Math.round(progress * 100)}%`;
    });
  }

  /** Swap into error mode (WebGL missing, boot failure). */
  showError(message: string): void {
    this.offProgress();
    const card = this.root.querySelector('.loading-card') as HTMLElement;
    card.innerHTML = `<h1 class="loading-title">${t('app.title')}</h1><p class="loading-error"></p>`;
    (card.querySelector('.loading-error') as HTMLElement).textContent = message;
  }

  /** Fade out and remove (world is ready behind it). */
  dismiss(): void {
    this.offProgress();
    this.root.classList.add('loading-done');
    setTimeout(() => this.root.remove(), 700);
  }
}
