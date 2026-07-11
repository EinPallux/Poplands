/**
 * Runtime settings store (S23): signals over the persisted SaveSettings.
 * Presentation systems read these; the save system serializes them.
 */
import { signal } from './signals';
import { DEFAULT_SETTINGS, type SaveSettings } from './save';

export const volumeSignal = signal(DEFAULT_SETTINGS.volume);
export const musicVolumeSignal = signal(DEFAULT_SETTINGS.musicVolume);
export const qualitySignal = signal<SaveSettings['quality']>(DEFAULT_SETTINGS.quality);
export const reducedMotionSignal = signal(
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? true
    : DEFAULT_SETTINGS.reducedMotion,
);
export const timeOfDaySignal = signal<SaveSettings['timeOfDay']>(DEFAULT_SETTINGS.timeOfDay);
export const fpsCapSignal = signal<SaveSettings['fpsCap']>(DEFAULT_SETTINGS.fpsCap);
export const uiScaleSignal = signal(DEFAULT_SETTINGS.uiScale);

export function loadSettings(s: SaveSettings): void {
  volumeSignal.set(s.volume);
  musicVolumeSignal.set(s.musicVolume);
  qualitySignal.set(s.quality);
  reducedMotionSignal.set(s.reducedMotion);
  timeOfDaySignal.set(s.timeOfDay);
  fpsCapSignal.set(s.fpsCap);
  uiScaleSignal.set(s.uiScale);
}

export function snapshotSettings(): SaveSettings {
  return {
    volume: volumeSignal.get(),
    musicVolume: musicVolumeSignal.get(),
    quality: qualitySignal.get(),
    reducedMotion: reducedMotionSignal.get(),
    timeOfDay: timeOfDaySignal.get(),
    fpsCap: fpsCapSignal.get(),
    uiScale: uiScaleSignal.get(),
  };
}

/** Convenience for non-reactive readers (juice presets). */
export const isReducedMotion = (): boolean => reducedMotionSignal.get();
