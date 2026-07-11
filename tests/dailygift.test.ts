import { describe, it, expect } from 'vitest';
import { DailyGiftSystem } from '@/sim/DailyGiftSystem';
import { GIFT_CYCLE } from '@/content/dailyGifts';
import { bus } from '@/core/events';
import { freshDailyGift } from '@/core/save';

/** Local noon on a given date — a deterministic per-day timestamp. */
const DAY = (y: number, m: number, d: number): number => new Date(y, m, d, 12).getTime();

/** Capture the day + pops from the next gift:claimed, unsubscribing after. */
function captureClaim(fn: () => void): { day: number; pops: number; stardust: number } {
  let day = 0;
  let pops = 0;
  let stardust = 0;
  const off = bus.on('gift:claimed', (e) => {
    day = e.day;
    pops = e.rewards.pops ?? 0;
    stardust = e.rewards.stardust ?? 0;
  });
  fn();
  off();
  return { day, pops, stardust };
}

describe('DailyGiftSystem', () => {
  it('first claim grants the day-1 gift, then locks for the rest of the day', () => {
    const state = freshDailyGift();
    const sys = new DailyGiftSystem(state, () => DAY(2026, 0, 1));
    expect(sys.canClaim()).toBe(true);
    const c = captureClaim(() => expect(sys.claim()).toBe(true));
    expect(c.day).toBe(1);
    expect(c.pops).toBe(GIFT_CYCLE[0]!.pops);
    expect(state.claims).toBe(1);
    // same calendar day → locked
    expect(sys.canClaim()).toBe(false);
    expect(sys.claim()).toBe(false);
    expect(state.claims).toBe(1);
  });

  it('a new calendar day unlocks the next gift and advances the cycle', () => {
    const state = freshDailyGift();
    let now = DAY(2026, 0, 1);
    const sys = new DailyGiftSystem(state, () => now);
    sys.claim(); // day 1
    now = DAY(2026, 0, 2);
    expect(sys.canClaim()).toBe(true);
    const c = captureClaim(() => sys.claim());
    expect(c.day).toBe(2);
    expect(state.claims).toBe(2);
  });

  it('missing days never punishes — the cycle is per-claim, not per calendar day', () => {
    const state = freshDailyGift();
    let now = DAY(2026, 0, 1);
    const sys = new DailyGiftSystem(state, () => now);
    sys.claim(); // day 1
    now = DAY(2026, 0, 10); // skipped a week+
    const c = captureClaim(() => expect(sys.claim()).toBe(true));
    expect(c.day).toBe(2); // resumes at day 2, not reset to day 1
  });

  it('the 7-day cycle loops back to day 1', () => {
    const state = { lastClaimDay: 0, claims: 6 }; // the next claim is the 7th (day 7)
    let now = DAY(2026, 0, 1);
    const sys = new DailyGiftSystem(state, () => now);
    expect(captureClaim(() => sys.claim()).day).toBe(7);
    now = DAY(2026, 0, 2);
    expect(captureClaim(() => sys.claim()).day).toBe(1); // loops
  });

  it('a backward / tampered clock keeps the gift locked (no crash, no penalty)', () => {
    const state = freshDailyGift();
    let now = DAY(2026, 5, 10);
    const sys = new DailyGiftSystem(state, () => now);
    sys.claim();
    now = DAY(2026, 5, 9); // clock moved back a day
    expect(sys.canClaim()).toBe(false);
    expect(sys.claim()).toBe(false);
  });

  it('preview reports the next reward + claimable state without granting it', () => {
    const state = freshDailyGift();
    const sys = new DailyGiftSystem(state, () => DAY(2026, 0, 1));
    const p = sys.preview();
    expect(p.day).toBe(1);
    expect(p.pops).toBe(GIFT_CYCLE[0]!.pops);
    expect(p.claimable).toBe(true);
    expect(state.claims).toBe(0); // preview must not mutate
  });
});
