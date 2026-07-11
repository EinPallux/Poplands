/**
 * Daily gift (post-1.0): a cozy welcome present each real-world day. The reward
 * escalates across a looping 7-day cycle — and missing days NEVER punishes you:
 * the cycle advances per CLAIM, not per calendar day, so you simply pick up the
 * next present whenever you return (no streak-loss, no expiry — the no-FOMO
 * covenant, GDD §7.5). Content-as-data, three.js-free.
 */
export interface GiftDef {
  pops: number;
  stardust?: number;
}

/** Seven escalating presents; day 4 sprinkles a Stardust, day 7 is the big one. */
export const GIFT_CYCLE: readonly GiftDef[] = [
  { pops: 40 },
  { pops: 60 },
  { pops: 80 },
  { pops: 60, stardust: 1 },
  { pops: 120 },
  { pops: 150 },
  { pops: 100, stardust: 2 },
];

const wrap = (claims: number): number =>
  ((claims % GIFT_CYCLE.length) + GIFT_CYCLE.length) % GIFT_CYCLE.length;

/** The gift for the Nth claim (0-based). Loops the 7-day cycle. */
export function giftForClaim(claims: number): GiftDef {
  return GIFT_CYCLE[wrap(claims)]!;
}

/** The 1-based day-in-cycle label for the Nth claim (1…7). */
export function giftDay(claims: number): number {
  return wrap(claims) + 1;
}
