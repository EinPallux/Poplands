/**
 * Liveliness dividend (S13, v0.5): a lively island quietly pays a little extra.
 * Every interval, each resident Islander & Pal chips in a few Pops — "the
 * neighbours pitch in". THREE.JS-FREE, time-gated (never per-click), and capped,
 * so it can't be farmed; it just rewards building a place worth living in.
 *
 * v0.7: a placed Grand Assembly Hall lifts the whole payout by an injected
 * `bonus()` fraction (island-wide +5% each, stack-capped by the caller).
 */
const INTERVAL_S = 10;
const POPS_PER_SOUL = 2;
const MAX_SOULS = 18;

export class LivelinessSystem {
  private timer = 0;

  constructor(
    private readonly economy: { credit: (pops: number, stardust?: number) => void },
    private readonly population: () => number,
    /** Extra dividend fraction from civic buildings (0 = none, 0.05 = +5%). */
    private readonly bonus: () => number = () => 0,
  ) {}

  update(dt: number): void {
    this.timer += dt;
    if (this.timer < INTERVAL_S) return;
    this.timer -= INTERVAL_S;
    const souls = Math.min(this.population(), MAX_SOULS);
    if (souls > 0) {
      const base = souls * POPS_PER_SOUL;
      this.economy.credit(Math.round(base * (1 + Math.max(0, this.bonus()))), 0);
    }
  }
}
