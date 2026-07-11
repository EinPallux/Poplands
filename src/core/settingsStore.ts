/**
 * Runtime settings store (S23): signals over the persisted SaveSettings.
 * Presentation systems read these; the save system serializes them.
 */
import { signal } from './signals';
import { DEFAULT_SETTINGS, type SaveSettings } from './save';

export const volumeSignal = signal(DEFAULT_SETTINGS.volume);
export const qualitySignal = signal<SaveSettings['quality']>(DEFAULT_SETTINGS.quality);
export const reducedMotionSignal = signal(
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? true
    : DEFAULT_SETTINGS.reducedMotion,
);

export function loadSettings(s: SaveSettings): void {
  volumeSignal.set(s.volume);
  qualitySignal.set(s.quality);
  reducedMotionSignal.set(s.reducedMotion);
}

export function snapshotSettings(): SaveSettings {
  return {
    volume: volumeSignal.get(),
    quality: qualitySignal.get(),
    reducedMotion: reducedMotionSignal.get(),
  };
}

/** Convenience for non-reactive readers (juice presets). */
export const isReducedMotion = (): boolean => reducedMotionSignal.get();
