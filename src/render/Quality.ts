/**
 * Quality tiers (TECH §6.6): one config object consumed everywhere — no scattered
 * `if (isLow)`. Auto-probe starts at high and steps down if measured fps sags.
 */

export type QualityTier = 'high' | 'medium' | 'low';

export interface QualityConfig {
  tier: QualityTier;
  pixelRatioCap: number;
  shadowMapSize: number;
  shadowsEnabled: boolean;
  cloudCount: number;
}

export const QUALITY_PRESETS: Record<QualityTier, QualityConfig> = {
  high: { tier: 'high', pixelRatioCap: 2, shadowMapSize: 2048, shadowsEnabled: true, cloudCount: 12 },
  medium: { tier: 'medium', pixelRatioCap: 1.5, shadowMapSize: 1024, shadowsEnabled: true, cloudCount: 8 },
  low: { tier: 'low', pixelRatioCap: 1, shadowMapSize: 512, shadowsEnabled: false, cloudCount: 5 },
};

/**
 * Watches average fps after boot and steps the tier down when the device can't
 * keep up. Steps down only (never up mid-session — avoids oscillation).
 */
export class QualityProbe {
  private elapsed = 0;
  private frames = 0;
  private windowTime = 0;
  private settled = false;

  constructor(
    private current: QualityTier,
    private readonly apply: (config: QualityConfig) => void,
    private readonly warmupSeconds = 2,
    private readonly windowSeconds = 3,
  ) {}

  get tier(): QualityTier {
    return this.current;
  }

  update(dt: number): void {
    if (this.settled) return;
    this.elapsed += dt;
    if (this.elapsed < this.warmupSeconds) return; // ignore load/compile hitches
    this.windowTime += dt;
    this.frames++;
    if (this.windowTime < this.windowSeconds) return;

    const fps = this.frames / this.windowTime;
    this.frames = 0;
    this.windowTime = 0;

    if (fps >= 45) {
      this.settled = true; // good enough — lock it in
      return;
    }
    const next: QualityTier | null =
      this.current === 'high' ? 'medium' : this.current === 'medium' ? 'low' : null;
    if (next === null) {
      this.settled = true;
      return;
    }
    console.info(`[quality] ${fps.toFixed(0)} fps — stepping ${this.current} → ${next}`);
    this.current = next;
    this.apply(QUALITY_PRESETS[next]);
  }
}
