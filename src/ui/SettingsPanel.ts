/**
 * Settings mini-panel (S23): quality, volume, reduced motion, save export/import.
 * One panel at a time, Esc-dismissable (GDD §11.3).
 */
import { t } from '@/core/strings';
import { effect } from '@/core/signals';
import {
  volumeSignal,
  musicVolumeSignal,
  qualitySignal,
  reducedMotionSignal,
  timeOfDaySignal,
  seasonSignal,
  fpsCapSignal,
  uiScaleSignal,
} from '@/core/settingsStore';
import { bus } from '@/core/events';
import type { SaveSettings } from '@/core/save';
import { showToast } from './Toasts';

export class SettingsPanel {
  private root: HTMLDivElement;
  private panel: HTMLDivElement;
  open = false;

  constructor(
    parent: HTMLElement,
    private readonly onExport: () => void,
    private readonly onImport: (file: File) => void,
    version: string,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'settings-root';
    parent.appendChild(this.root);

    const gear = document.createElement('button');
    gear.className = 'settings-gear';
    gear.setAttribute('aria-label', t('settings.title'));
    gear.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 4a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2L16 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2L12 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.2-.8.2-1.2z"/></svg>';
    gear.addEventListener('click', () => this.toggle());
    this.root.appendChild(gear);

    this.panel = document.createElement('div');
    this.panel.className = 'settings-panel';
    this.panel.style.display = 'none';
    this.panel.innerHTML = `
      <h2>${t('settings.title')}</h2>
      <label class="settings-row">
        <span>${t('settings.quality')}</span>
        <select class="s-quality">
          <option value="auto">${t('settings.quality.auto')}</option>
          <option value="high">${t('settings.quality.high')}</option>
          <option value="medium">${t('settings.quality.medium')}</option>
          <option value="low">${t('settings.quality.low')}</option>
        </select>
      </label>
      <label class="settings-row">
        <span>${t('settings.time')}</span>
        <select class="s-time">
          <option value="auto">${t('settings.time.auto')}</option>
          <option value="day">${t('settings.time.day')}</option>
          <option value="dusk">${t('settings.time.dusk')}</option>
          <option value="night">${t('settings.time.night')}</option>
        </select>
      </label>
      <label class="settings-row">
        <span>${t('settings.season')}</span>
        <select class="s-season">
          <option value="auto">${t('settings.season.auto')}</option>
          <option value="spring">${t('settings.season.spring')}</option>
          <option value="summer">${t('settings.season.summer')}</option>
          <option value="autumn">${t('settings.season.autumn')}</option>
          <option value="winter">${t('settings.season.winter')}</option>
        </select>
      </label>
      <label class="settings-row">
        <span>${t('settings.volume')}</span>
        <input class="s-volume" type="range" min="0" max="1" step="0.05">
      </label>
      <label class="settings-row">
        <span>${t('settings.music')}</span>
        <input class="s-music" type="range" min="0" max="1" step="0.05">
      </label>
      <label class="settings-row">
        <span>${t('settings.fps')}</span>
        <select class="s-fps">
          <option value="off">${t('settings.fps.off')}</option>
          <option value="30">${t('settings.fps.30')}</option>
          <option value="60">${t('settings.fps.60')}</option>
        </select>
      </label>
      <label class="settings-row">
        <span>${t('settings.uiScale')}</span>
        <select class="s-uiscale">
          <option value="0.85">${t('settings.uiScale.small')}</option>
          <option value="1">${t('settings.uiScale.normal')}</option>
          <option value="1.15">${t('settings.uiScale.large')}</option>
          <option value="1.3">${t('settings.uiScale.xlarge')}</option>
        </select>
      </label>
      <label class="settings-row settings-check">
        <input class="s-motion" type="checkbox">
        <span>${t('settings.reducedMotion')}</span>
      </label>
      <div class="settings-actions">
        <button class="s-export">${t('settings.export')}</button>
        <button class="s-import">${t('settings.import')}</button>
      </div>
      <input class="s-file" type="file" accept=".json,application/json" style="display:none">
      <div class="settings-version">v${version}</div>`;
    this.root.appendChild(this.panel);

    const quality = this.panel.querySelector('.s-quality') as HTMLSelectElement;
    const time = this.panel.querySelector('.s-time') as HTMLSelectElement;
    const season = this.panel.querySelector('.s-season') as HTMLSelectElement;
    const fps = this.panel.querySelector('.s-fps') as HTMLSelectElement;
    const uiScale = this.panel.querySelector('.s-uiscale') as HTMLSelectElement;
    const volume = this.panel.querySelector('.s-volume') as HTMLInputElement;
    const music = this.panel.querySelector('.s-music') as HTMLInputElement;
    const motion = this.panel.querySelector('.s-motion') as HTMLInputElement;
    const file = this.panel.querySelector('.s-file') as HTMLInputElement;

    effect(() => (quality.value = qualitySignal.get()));
    effect(() => (time.value = timeOfDaySignal.get()));
    effect(() => (season.value = seasonSignal.get()));
    effect(() => (fps.value = fpsCapSignal.get()));
    effect(() => (uiScale.value = String(uiScaleSignal.get())));
    effect(() => (volume.value = String(volumeSignal.get())));
    effect(() => (music.value = String(musicVolumeSignal.get())));
    effect(() => (motion.checked = reducedMotionSignal.get()));

    fps.addEventListener('change', () => {
      fpsCapSignal.set(fps.value as SaveSettings['fpsCap']);
      bus.emit('settings:changed', undefined);
    });
    uiScale.addEventListener('change', () => {
      uiScaleSignal.set(Number(uiScale.value));
      bus.emit('settings:changed', undefined);
    });

    quality.addEventListener('change', () => {
      qualitySignal.set(quality.value as SaveSettings['quality']);
      bus.emit('settings:changed', undefined);
    });
    time.addEventListener('change', () => {
      timeOfDaySignal.set(time.value as SaveSettings['timeOfDay']);
      bus.emit('settings:changed', undefined);
    });
    season.addEventListener('change', () => {
      seasonSignal.set(season.value as SaveSettings['season']);
      bus.emit('settings:changed', undefined);
    });
    volume.addEventListener('input', () => {
      volumeSignal.set(Number(volume.value));
      bus.emit('settings:changed', undefined);
    });
    music.addEventListener('input', () => {
      musicVolumeSignal.set(Number(music.value));
      bus.emit('settings:changed', undefined);
    });
    motion.addEventListener('change', () => {
      reducedMotionSignal.set(motion.checked);
      bus.emit('settings:changed', undefined);
    });
    (this.panel.querySelector('.s-export') as HTMLButtonElement).addEventListener('click', () => {
      this.onExport();
      showToast(t('settings.exported'));
    });
    (this.panel.querySelector('.s-import') as HTMLButtonElement).addEventListener('click', () =>
      file.click(),
    );
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      if (f) this.onImport(f);
      file.value = '';
    });
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.panel.style.display = this.open ? '' : 'none';
  }
}
