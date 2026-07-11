/**
 * Background music (S22): loops an OPTIONAL, user-supplied `bgm.mp3` dropped into
 * the deploy root (public/ → served at `/`). The feature is entirely opt-in — if
 * no file is present the system stays a silent no-op and never surfaces an error
 * the player didn't cause. Volume tracks the `musicVolume` setting; playback
 * unlocks on the first user gesture (browser autoplay policy).
 */
import { musicVolumeSignal } from '@/core/settingsStore';
import { effect } from '@/core/signals';

// Relative so it resolves under Vite's base './' (Vercel/itch subpaths alike).
const BGM_URL = 'bgm.mp3';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export class MusicSystem {
  private audio: HTMLAudioElement | null = null;
  private playing = false;

  constructor() {
    if (typeof Audio === 'undefined' || typeof window === 'undefined') return;
    const audio = new Audio(BGM_URL);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = clamp01(musicVolumeSignal.get());
    // A missing/undecodable bgm.mp3 fires 'error' during preload → disable quietly.
    audio.addEventListener('error', () => this.disable());
    this.audio = audio;

    // Live-track the slider (no reload needed to hear a volume change).
    effect(() => {
      if (this.audio) this.audio.volume = clamp01(musicVolumeSignal.get());
    });

    // Autoplay is gated behind a gesture; the first click/keypress starts the bed.
    window.addEventListener('pointerdown', this.unlock);
    window.addEventListener('keydown', this.unlock);
  }

  private unlock = (): void => {
    if (this.playing || !this.audio) return;
    void this.audio
      .play()
      .then(() => {
        this.playing = true;
        this.removeUnlockListeners(); // latched — stop listening once it's rolling
      })
      .catch(() => {
        // A missing/undecodable file sets media.error → give up quietly; a mere
        // transient autoplay block leaves it unset, so a later gesture retries.
        if (this.audio?.error) this.disable();
      });
  };

  /** No usable track — release the element and stop waiting for a gesture. */
  private disable(): void {
    this.removeUnlockListeners();
    this.audio = null;
  }

  private removeUnlockListeners(): void {
    window.removeEventListener('pointerdown', this.unlock);
    window.removeEventListener('keydown', this.unlock);
  }
}
