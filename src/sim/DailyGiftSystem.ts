/**
 * Daily gift (post-1.0): a cozy welcome present each real-world day. THREE.JS-FREE.
 *
 * Once per LOCAL calendar day you may open a present; the reward escalates across
 * a looping 7-day cycle. Missing days NEVER punishes — the cycle advances per
 * CLAIM, not per calendar day (no streak-loss, no expiry: the no-FOMO covenant,
 * GDD §7.5). The reward flows through `gift:claimed`, credited by Economy (like
 * quests/secrets). A backward / tampered clock simply keeps the gift locked —
 * never a crash, never a penalty. Mutates the save slice in place.
 */
import { bus } from '@/core/events';
import type { SaveDailyGift } from '@/core/save';
import { giftForClaim, giftDay } from '@/content/dailyGifts';

export class DailyGiftSystem {
  constructor(
    private readonly state: SaveDailyGift,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** YYYYMMDD key of the LOCAL calendar day — monotonically increases with date. */
  private dayKey(now: number): number {
    const d = new Date(now);
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  canClaim(now = this.now()): boolean {
    return this.dayKey(now) > this.state.lastClaimDay;
  }

  /** Announce readiness once (GameState.start, after presentation has subscribed). */
  announce(): void {
    if (this.canClaim()) bus.emit('gift:available', undefined);
  }

  /** Open today's present. Returns false (no-op) if already claimed today. */
  claim(now = this.now()): boolean {
    if (!this.canClaim(now)) return false;
    const gift = giftForClaim(this.state.claims);
    const day = giftDay(this.state.claims);
    this.state.lastClaimDay = this.dayKey(now);
    this.state.claims += 1;
    bus.emit('gift:claimed', {
      day,
      rewards: { pops: gift.pops, ...(gift.stardust ? { stardust: gift.stardust } : {}) },
    });
    return true;
  }

  /** What the NEXT claim would grant (for the UI + debug). */
  preview(): { day: number; pops: number; stardust: number; claimable: boolean } {
    const gift = giftForClaim(this.state.claims);
    return {
      day: giftDay(this.state.claims),
      pops: gift.pops,
      stardust: gift.stardust ?? 0,
      claimable: this.canClaim(),
    };
  }
}
