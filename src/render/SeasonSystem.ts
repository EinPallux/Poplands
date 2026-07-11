/**
 * Seasons (post-1.0): multiplies a per-season tint onto the day-night colors so
 * the whole island shifts through spring → summer → autumn → winter.
 *
 * Runs AFTER TimeOfDay each frame: TimeOfDay re-`.copy()`s the base light/sky/fog
 * colors every frame, so this component-wise `.multiply()` MODULATES the cycle
 * without ever accumulating. Tinting the light (not just the lawn) shifts the
 * whole scene — grass, trees, buildings — together, and layers cleanly over the
 * biome themes. Reads `seasonSignal` ('auto' resolves to the real-world month);
 * `current` drives which falling-ambient SeasonAmbience shows.
 */
import { Color } from 'three';
import { effect } from '@/core/signals';
import { seasonSignal } from '@/core/settingsStore';
import { resolveSeason, seasonDef, type Season } from '@/content/seasons';
import type { Lights } from './Lights';
import type { Sky } from './Sky';

export class SeasonSystem {
  private readonly lightTint = new Color(1, 1, 1);
  private readonly skyTint = new Color(1, 1, 1);
  private lightMul = 1;
  private _current: Season = 'spring';
  private readonly stop: () => void;

  constructor(
    private readonly lights: Lights,
    private readonly sky: Sky,
    private readonly fog: { color: Color },
  ) {
    // Recompute the cached tints whenever the season setting changes (rare).
    this.stop = effect(() => {
      const setting = seasonSignal.get();
      const month = typeof Date === 'undefined' ? 0 : new Date().getMonth();
      this._current = resolveSeason(setting, month);
      const def = seasonDef(this._current);
      this.lightTint.setRGB(def.light[0], def.light[1], def.light[2]);
      this.skyTint.setRGB(def.sky[0], def.sky[1], def.sky[2]);
      this.lightMul = def.lightMul;
    });
  }

  get current(): Season {
    return this._current;
  }

  /** Multiply the seasonal tint onto the (freshly day-night-written) live colors.
   *  Called each frame right after `timeOfDay.update()`. */
  update(): void {
    this.lights.sun.color.multiply(this.lightTint);
    this.lights.sun.intensity *= this.lightMul;
    this.lights.hemi.color.multiply(this.lightTint);
    this.lights.hemi.groundColor.multiply(this.lightTint);
    this.fog.color.multiply(this.lightTint);
    this.sky.setSeasonTint(this.skyTint);
  }

  dispose(): void {
    this.stop();
  }
}
