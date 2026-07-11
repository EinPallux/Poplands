/**
 * Seasons (post-1.0) as data — content-as-data, three.js-free. Each season carries
 * light/sky tint MULTIPLIERS (applied on top of the day-night colors, so seasons
 * MODULATE the cycle rather than replace it) plus which falling-ambient it shows.
 * Seasons layer over the biome themes too — nothing here is biome-specific.
 */
import type { StringKey } from '@/core/strings';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type SeasonSetting = 'auto' | Season;
export type SeasonAmbientKind = 'petals' | 'motes' | 'leaves' | 'snow';

/** An RGB multiplier (~1.0) applied to a live Color via component-wise multiply. */
export type Tint = readonly [number, number, number];

export interface SeasonDef {
  id: Season;
  nameKey: StringKey;
  emoji: string;
  /** Multiplied onto the directional + hemisphere light + fog colors each frame. */
  light: Tint;
  /** Extra multiplier on the directional light intensity (winter dimmer, summer brighter). */
  lightMul: number;
  /** Multiplied onto the sky-dome colors. */
  sky: Tint;
  ambient: SeasonAmbientKind;
}

const s = (d: SeasonDef): SeasonDef => d;

export const SEASONS: Record<Season, SeasonDef> = {
  spring: s({ id: 'spring', nameKey: 'settings.season.spring', emoji: '🌸', light: [1.03, 1.05, 0.99], lightMul: 1.02, sky: [1.02, 1.03, 1.0], ambient: 'petals' }),
  summer: s({ id: 'summer', nameKey: 'settings.season.summer', emoji: '☀️', light: [1.08, 1.03, 0.9], lightMul: 1.06, sky: [1.05, 1.02, 0.92], ambient: 'motes' }),
  autumn: s({ id: 'autumn', nameKey: 'settings.season.autumn', emoji: '🍂', light: [1.13, 0.99, 0.78], lightMul: 1.0, sky: [1.09, 0.99, 0.82], ambient: 'leaves' }),
  winter: s({ id: 'winter', nameKey: 'settings.season.winter', emoji: '❄️', light: [0.88, 0.95, 1.13], lightMul: 0.95, sky: [0.9, 0.96, 1.12], ambient: 'snow' }),
};

export const SEASON_ORDER: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** Real-world month (0-11) → season (northern hemisphere; fine for v1). */
export function seasonForMonth(month: number): Season {
  if (month <= 1 || month === 11) return 'winter'; // Dec, Jan, Feb
  if (month <= 4) return 'spring'; // Mar, Apr, May
  if (month <= 7) return 'summer'; // Jun, Jul, Aug
  return 'autumn'; // Sep, Oct, Nov
}

/** Resolve the setting ('auto' → the current real month) to a concrete season. */
export function resolveSeason(setting: SeasonSetting, month: number): Season {
  return setting === 'auto' ? seasonForMonth(month) : setting;
}

export function seasonDef(season: Season): SeasonDef {
  return SEASONS[season];
}
