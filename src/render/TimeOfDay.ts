/**
 * Day-night cycle (S7, v0.5): drives the two lights, the sky dome, and the fog
 * through dawn → day → dusk → night on a slow loop. Keyframed and lerped each
 * frame into the LIVE light/uniform objects (no per-frame allocation). The sun's
 * *direction* stays fixed (so the shadow box never needs a per-frame refit — S5);
 * only colour, intensity, and the sky gradient move, which carries the whole mood
 * cheaply. `nightFactor` (0 day … 1 night) is published for lantern glow + ambient
 * events (shooting stars only come out at night).
 *
 * The setting freezes it: 'auto' cycles; 'day'/'dusk'/'night' hold that sky.
 */
import { Color } from 'three';
import type { Fog } from 'three';
import type { Lights } from './Lights';
import type { Sky } from './Sky';
import { timeOfDaySignal } from '@/core/settingsStore';

interface Key {
  at: number; // phase 0..1
  night: number; // 0 = full day, 1 = deep night (glow/event driver)
  skyTop: number;
  skyHorizon: number;
  skyCream: number;
  sun: number;
  sunI: number;
  hemiSky: number;
  hemiGround: number;
  hemiI: number;
  fog: number;
  sunSprite: number;
}

// One cozy loop. Day sits at ~0.3, night around ~0.75; the segments in between
// are the golden dawn/dusk beats the screenshots live for.
const KEYS: readonly Key[] = [
  { at: 0.0, night: 0.15, skyTop: 0x8fb8e8, skyHorizon: 0xffd9b0, skyCream: 0xffcfa0, sun: 0xffd2a0, sunI: 1.9, hemiSky: 0xcdd8f0, hemiGround: 0x9a8478, hemiI: 1.2, fog: 0xffe4cc, sunSprite: 0.85 },
  { at: 0.28, night: 0.0, skyTop: 0x7ec8f5, skyHorizon: 0xeaf7ff, skyCream: 0xffe9c9, sun: 0xfff3d6, sunI: 2.7, hemiSky: 0xbfdfff, hemiGround: 0x8c7a6b, hemiI: 1.35, fog: 0xdceefb, sunSprite: 1.0 },
  { at: 0.5, night: 0.4, skyTop: 0x6a86c4, skyHorizon: 0xff9d6b, skyCream: 0xffb27a, sun: 0xff9d5c, sunI: 1.7, hemiSky: 0xb6a6d0, hemiGround: 0x7a6a68, hemiI: 1.05, fog: 0xf2c39a, sunSprite: 0.95 },
  { at: 0.64, night: 1.0, skyTop: 0x1f2a52, skyHorizon: 0x3a4a80, skyCream: 0x46589a, sun: 0xb9c7ff, sunI: 0.5, hemiSky: 0x54649c, hemiGround: 0x323c5a, hemiI: 0.5, fog: 0x2a3560, sunSprite: 0.0 },
  { at: 0.86, night: 1.0, skyTop: 0x1f2a52, skyHorizon: 0x3a4a80, skyCream: 0x46589a, sun: 0xb9c7ff, sunI: 0.5, hemiSky: 0x54649c, hemiGround: 0x323c5a, hemiI: 0.5, fog: 0x2a3560, sunSprite: 0.0 },
  { at: 1.0, night: 0.15, skyTop: 0x8fb8e8, skyHorizon: 0xffd9b0, skyCream: 0xffcfa0, sun: 0xffd2a0, sunI: 1.9, hemiSky: 0xcdd8f0, hemiGround: 0x9a8478, hemiI: 1.2, fog: 0xffe4cc, sunSprite: 0.85 },
];

const FROZEN: Record<string, number> = { day: 0.28, dusk: 0.5, night: 0.75 };
const CYCLE_SECONDS = 240; // a full day every 4 minutes

export class TimeOfDay {
  private phase = 0.28; // start at bright day
  private _night = 0;
  // scratch colours (reused every frame)
  private cTop = new Color();
  private cHor = new Color();
  private cCream = new Color();
  private cSun = new Color();
  private cHemiS = new Color();
  private cHemiG = new Color();
  private cFog = new Color();
  private a = new Color();
  private b = new Color();

  constructor(
    private readonly lights: Lights,
    private readonly sky: Sky,
    private readonly fog: Fog,
  ) {}

  /** 0 in full day … 1 in deep night — for lantern glow & night-only events. */
  get nightFactor(): number {
    return this._night;
  }

  update(dt: number): void {
    const setting = timeOfDaySignal.get();
    if (setting === 'auto') {
      this.phase = (this.phase + dt / CYCLE_SECONDS) % 1;
    } else {
      this.phase = FROZEN[setting] ?? 0.28;
    }
    this.apply(this.phase);
  }

  private apply(phase: number): void {
    let i = 0;
    while (i < KEYS.length - 1 && KEYS[i + 1]!.at <= phase) i++;
    const k0 = KEYS[i]!;
    const k1 = KEYS[Math.min(i + 1, KEYS.length - 1)]!;
    const span = k1.at - k0.at || 1;
    const t = Math.min(1, Math.max(0, (phase - k0.at) / span));

    this._night = k0.night + (k1.night - k0.night) * t;
    const sunI = k0.sunI + (k1.sunI - k0.sunI) * t;
    const hemiI = k0.hemiI + (k1.hemiI - k0.hemiI) * t;
    const sprite = k0.sunSprite + (k1.sunSprite - k0.sunSprite) * t;

    this.lights.sun.color.copy(lerpHex(this.a, this.b, k0.sun, k1.sun, t, this.cSun));
    this.lights.sun.intensity = sunI;
    this.lights.hemi.color.copy(lerpHex(this.a, this.b, k0.hemiSky, k1.hemiSky, t, this.cHemiS));
    this.lights.hemi.groundColor.copy(lerpHex(this.a, this.b, k0.hemiGround, k1.hemiGround, t, this.cHemiG));
    this.lights.hemi.intensity = hemiI;

    lerpHex(this.a, this.b, k0.skyTop, k1.skyTop, t, this.cTop);
    lerpHex(this.a, this.b, k0.skyHorizon, k1.skyHorizon, t, this.cHor);
    lerpHex(this.a, this.b, k0.skyCream, k1.skyCream, t, this.cCream);
    this.sky.setSky(this.cTop, this.cHor, this.cCream, sprite, this._night);

    this.fog.color.copy(lerpHex(this.a, this.b, k0.fog, k1.fog, t, this.cFog));
  }
}

function lerpHex(a: Color, b: Color, h0: number, h1: number, t: number, out: Color): Color {
  a.setHex(h0);
  b.setHex(h1);
  return out.copy(a).lerp(b, t);
}
