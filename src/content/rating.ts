/**
 * Island Charm rating (post-1.0, user 2026-07-12): a cozy "how lovely is your island"
 * star score with gentle, actionable tips for what to add next. THREE.JS-FREE, pure —
 * a derived read over a plain snapshot, so it never persists and can be unit-tested.
 *
 * Design is strictly no-grind (GDD §7.5): every axis is ADDITIVE with diminishing
 * returns (`count / (count + k)`), never a penalty. A brand-new island still earns a
 * friendly half-star and encouraging tips; a lavish one tops out near 5 with a "nothing
 * to add" congratulation. The tips double as the "what do I do next?" cure for feeling
 * lost — they point at the lowest axes with a concrete, cheerful suggestion.
 */
import type { StringKey } from '@/core/strings';

export interface RatingSnapshot {
  chunks: number;
  nature: number; // placed nature items (trees/flowers/bushes…)
  homes: number; // placed home buildings
  neighbours: number; // Islanders living here
  decor: number; // placed decorations
  income: number; // placed income buildings
  pals: number; // animal friends
  distinctTypes: number; // how many different item kinds are placed (variety)
  crops: number; // garden patches
}

export interface RatingCategory {
  id: string;
  labelKey: StringKey;
  tipKey: StringKey;
  k: number; // saturation constant — larger = slower to fill
  value: (s: RatingSnapshot) => number;
}

/** The six charm axes. Each returns a raw "how much of this you have" count. */
// k values are picked so a well-built island's axes clear the tip threshold at their
// natural caps (e.g. the 36-chunk soft cap should read as "done", not nag forever).
export const RATING_CATEGORIES: readonly RatingCategory[] = [
  { id: 'greenery', labelKey: 'rating.greenery', tipKey: 'rating.tip.greenery', k: 10, value: (s) => s.nature },
  { id: 'community', labelKey: 'rating.community', tipKey: 'rating.tip.community', k: 8, value: (s) => s.homes * 2 + s.neighbours },
  { id: 'charm', labelKey: 'rating.charm', tipKey: 'rating.tip.charm', k: 10, value: (s) => s.decor + s.distinctTypes * 0.5 },
  { id: 'critters', labelKey: 'rating.critters', tipKey: 'rating.tip.critters', k: 3, value: (s) => s.pals + s.crops * 0.5 },
  { id: 'bustle', labelKey: 'rating.bustle', tipKey: 'rating.tip.bustle', k: 5, value: (s) => s.income },
  { id: 'room', labelKey: 'rating.room', tipKey: 'rating.tip.room', k: 8, value: (s) => s.chunks },
];

export interface RatingBreakdown {
  id: string;
  labelKey: StringKey;
  fraction: number; // 0..1 how full this axis is
}
export interface RatingTip {
  id: string;
  tipKey: StringKey;
}
export interface RatingHappiness {
  score: number; // 0..1 how happy the neighbours are
  moodKey: StringKey; // Content / Happy / Cheerful / Delighted
  emoji: string;
}
export interface RatingResult {
  stars: number; // 0.5..5 in half steps
  overall: number; // 0..1 mean fraction (incl. the happiness nudge)
  verdictKey: StringKey;
  categories: RatingBreakdown[];
  tips: RatingTip[];
  happiness: RatingHappiness;
}

const TIP_THRESHOLD = 0.8; // an axis below this is worth suggesting
const MAX_TIPS = 3;
const HAPPINESS_K = 6; // amenities-per-neighbour to reach ~50% happy

function verdict(stars: number): StringKey {
  if (stars < 1.5) return 'rating.verdict.start';
  if (stars < 2.5) return 'rating.verdict.coming';
  if (stars < 3.5) return 'rating.verdict.charming';
  if (stars < 4.5) return 'rating.verdict.cozy';
  return 'rating.verdict.masterpiece';
}

/**
 * How happy the neighbours are (post-1.0), derived from the cosy amenities around them
 * per resident — nature, decorations, homes, Pals, gardens. Pure + always positive (the
 * lowest mood is just "settling in", never sad — no-fail covenant). Feeds the Charm
 * score and the liveliness dividend, and shows on the HUD.
 */
export function computeHappiness(s: RatingSnapshot): RatingHappiness {
  const amenities = s.nature + s.decor * 1.5 + s.homes + s.pals * 0.5 + s.crops * 0.5;
  const perCapita = amenities / Math.max(1, s.neighbours);
  const score = perCapita / (perCapita + HAPPINESS_K);
  const [moodKey, emoji]: [StringKey, string] =
    score < 0.3
      ? ['mood.content', '🙂']
      : score < 0.55
        ? ['mood.happy', '😊']
        : score < 0.8
          ? ['mood.cheerful', '😄']
          : ['mood.delighted', '🥰'];
  return { score, moodKey, emoji };
}

/** Compute the island's charm rating from a plain snapshot. Pure + deterministic. */
export function computeRating(s: RatingSnapshot): RatingResult {
  const categories = RATING_CATEGORIES.map((c) => {
    const v = c.value(s);
    return { id: c.id, labelKey: c.labelKey, fraction: v / (v + c.k), tipKey: c.tipKey };
  });
  const axesMean = categories.reduce((a, c) => a + c.fraction, 0) / categories.length;
  const happiness = computeHappiness(s);
  // happy neighbours lift the whole score a little (10% weight) — the island "feels" good
  const overall = axesMean * 0.9 + happiness.score * 0.1;
  // map to half-stars, generously (a genuinely rich island — axes averaging ~0.83 under
  // the saturation caps — reads as a full 5); floored at a friendly 0.5, capped at 5.
  const stars = Math.max(0.5, Math.min(5, Math.round(overall * 6 * 2) / 2));

  // tips: the lowest, least-filled axes first (only the ones still worth growing)
  const ranked = [...categories].sort((a, b) => a.fraction - b.fraction);
  const low = ranked.filter((c) => c.fraction < TIP_THRESHOLD).slice(0, MAX_TIPS);
  const tips: RatingTip[] =
    low.length > 0
      ? low.map((c) => ({ id: c.id, tipKey: c.tipKey }))
      : [{ id: 'perfect', tipKey: 'rating.tip.perfect' }];

  return {
    stars,
    overall,
    verdictKey: verdict(stars),
    categories: categories.map(({ id, labelKey, fraction }) => ({ id, labelKey, fraction })),
    tips,
    happiness,
  };
}
