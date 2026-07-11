/**
 * Liveliness dividend (S13, v0.5): a lively island quietly pays a little extra.
 * Every interval, each resident Islander & Pal chips in a few Pops — "the
 * neighbours pitch in". THREE.JS-FREE, time-gated (never per-click), and capped,
 * so it can't be farmed; it just rewards building a place worth living in.
 */
const INTERVAL_S = 10;
const POPS_PER_SOUL = 2;
const MAX_SOULS = 18;

export class LivelinessSystem {
  private timer = 0;

  constructor(
    private readonly economy: { credit: (pops: number, stardust?: number) => void },
    private readonly population: () => number,
  ) {}

  update(dt: number): void {
    this.timer += dt;
    if (this.timer < INTERVAL_S) return;
    this.timer -= INTERVAL_S;
    const souls = Math.min(this.population(), MAX_SOULS);
    if (souls > 0) this.economy.credit(souls * POPS_PER_SOUL, 0);
  }
}
