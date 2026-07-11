/**
 * Photo mode (S23, v0.6): hide the UI, drop a soft "diorama" vignette, and export
 * the current frame as a PNG. Toggled with P (or its button); Esc exits. The capture
 * callback renders one fresh frame and reads the canvas back, so it works without a
 * preserved drawing buffer.
 */
import { t } from '@/core/strings';
import { showToast } from './Toasts';

export class PhotoMode {
  active = false;
  private toolbar: HTMLDivElement;
  private vignette: HTMLDivElement;

  constructor(
    private readonly uiRoot: HTMLElement,
    private readonly capture: () => string,
  ) {
    this.vignette = document.createElement('div');
    this.vignette.className = 'photo-ui photo-vignette';
    this.vignette.style.display = 'none';
    uiRoot.appendChild(this.vignette);

    this.toolbar = document.createElement('div');
    this.toolbar.className = 'photo-ui photo-toolbar';
    this.toolbar.style.display = 'none';
    this.toolbar.innerHTML = `
      <span class="photo-hint">${t('photo.hint')}</span>
      <button class="photo-save">${t('photo.save')}</button>
      <button class="photo-exit">${t('photo.exit')}</button>`;
    uiRoot.appendChild(this.toolbar);

    (this.toolbar.querySelector('.photo-save') as HTMLButtonElement).addEventListener('click', () =>
      this.save(),
    );
    (this.toolbar.querySelector('.photo-exit') as HTMLButtonElement).addEventListener('click', () =>
      this.toggle(false),
    );
  }

  toggle(force?: boolean): void {
    this.active = force ?? !this.active;
    this.uiRoot.classList.toggle('photo-mode', this.active);
    this.vignette.style.display = this.active ? '' : 'none';
    this.toolbar.style.display = this.active ? '' : 'none';
  }

  private save(): void {
    try {
      const url = this.capture();
      const a = document.createElement('a');
      a.href = url;
      a.download = `poplands-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
      a.click();
      showToast(t('photo.saved'));
    } catch {
      showToast(t('photo.failed'));
    }
  }
}
