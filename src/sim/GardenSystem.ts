/**
 * Garden / Crop Patch (post-1.0): plant → grow → harvest. THREE.JS-FREE (sim).
 *
 * Each placed Garden Patch holds one plot. Tapping it plants a chosen seed (the UI
 * picker enforces the level gate); the crop then ripens over REAL time measured from
 * an absolute plant timestamp, so growth continues while you're away (offline-safe,
 * like income accrual). A ripe crop waits patiently forever — nothing ever wilts (the
 * no-FOMO covenant, GDD §7.5). Harvesting clears the plot and fires `garden:harvested`,
 * whose reward Economy + Progression credit via the same reward-event pattern as
 * fishing/museum. `now` is injected so unit tests pin growth deterministically.
 */
import { bus } from '@/core/events';
import { footprintCenter } from '@/core/grid';
import { itemDef } from '@/content/catalog';
import { cropDef } from '@/content/crops';
import type { SaveGarden } from '@/core/save';
import type { IslandModel } from '@/world/IslandModel';

export type PlotStage = 'empty' | 'sprout' | 'growing' | 'ripe';

export interface PlotView {
  placementId: string;
  crop: string;
  icon: string;
  wx: number;
  wz: number;
  stage: PlotStage;
  progress: number; // 0..1
}

export class GardenSystem {
  private readonly plots: Map<string, { crop: string; plantedAt: number }>;
  private harvestedCount: number;
  private unsubs: Array<() => void> = [];

  constructor(
    private readonly island: IslandModel,
    private readonly state: SaveGarden,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.plots = new Map(Object.entries(state.plots));
    this.harvestedCount = state.harvested;
  }

  /** Drop a plot when its patch is torn up (App routes cmd:openGarden separately). */
  wire(): void {
    this.unsubs.push(
      bus.on('item:removed', (e) => {
        if (this.plots.delete(e.id)) this.flush();
      }),
    );
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
  }

  /** Plant a seed in an empty patch. Returns false if the patch is busy/invalid. */
  plant(placementId: string, cropId: string): boolean {
    if (this.plots.has(placementId)) return false; // already growing something
    const p = this.island.placement(placementId);
    const def = p && itemDef(p.def);
    const crop = cropDef(cropId);
    if (!p || !def?.garden || !crop) return false;
    this.plots.set(placementId, { crop: cropId, plantedAt: this.now() });
    this.flush();
    const c = footprintCenter(p.wx, p.wz, def.footprint, p.rot);
    bus.emit('garden:planted', { placementId, crop: cropId, icon: crop.icon, wx: c.x, wz: c.z });
    return true;
  }

  /** Harvest a ripe patch → clear it, tally it, and fire the reward event. */
  harvest(placementId: string): boolean {
    if (this.stageOf(placementId) !== 'ripe') return false;
    const plot = this.plots.get(placementId)!;
    const crop = cropDef(plot.crop)!;
    const p = this.island.placement(placementId);
    const def = p && itemDef(p.def);
    if (!p || !def) return false;
    this.plots.delete(placementId);
    this.harvestedCount += 1;
    this.flush();
    const c = footprintCenter(p.wx, p.wz, def.footprint, p.rot);
    bus.emit('garden:harvested', {
      placementId,
      crop: plot.crop,
      nameKey: crop.nameKey,
      icon: crop.icon,
      rewards: { pops: crop.reward.pops, stardust: crop.reward.stardust ?? 0, xp: crop.reward.xp },
      wx: c.x,
      wz: c.z,
    });
    return true;
  }

  /** 0..1 growth of a plot (0 if empty). Clamped so a backward clock never goes negative. */
  progress(placementId: string): number {
    const plot = this.plots.get(placementId);
    const crop = plot && cropDef(plot.crop);
    if (!plot || !crop) return 0;
    return Math.max(0, Math.min(1, (this.now() - plot.plantedAt) / crop.growMs));
  }

  stageOf(placementId: string): PlotStage {
    if (!this.plots.has(placementId)) return 'empty';
    const pr = this.progress(placementId);
    if (pr >= 1) return 'ripe';
    if (pr >= 0.5) return 'growing';
    return 'sprout';
  }

  /** Live plot list for the world layer (skips any whose patch has vanished). */
  view(): PlotView[] {
    const out: PlotView[] = [];
    for (const [id, plot] of this.plots) {
      const p = this.island.placement(id);
      const def = p && itemDef(p.def);
      const crop = cropDef(plot.crop);
      if (!p || !def || !crop) continue;
      const c = footprintCenter(p.wx, p.wz, def.footprint, p.rot);
      out.push({
        placementId: id,
        crop: plot.crop,
        icon: crop.icon,
        wx: c.x,
        wz: c.z,
        stage: this.stageOf(id),
        progress: this.progress(id),
      });
    }
    return out;
  }

  get harvested(): number {
    return this.harvestedCount;
  }

  snapshot(): SaveGarden {
    return { plots: Object.fromEntries(this.plots), harvested: this.harvestedCount };
  }

  private flush(): void {
    this.state.plots = Object.fromEntries(this.plots);
    this.state.harvested = this.harvestedCount;
  }

  // ——— debug (headless verify; ?debug=1 only) ———

  /** Fast-forward a plot to ripe by back-dating its plant time. */
  debugRipen(placementId: string): void {
    const plot = this.plots.get(placementId);
    const crop = plot && cropDef(plot.crop);
    if (plot && crop) plot.plantedAt = this.now() - crop.growMs - 1;
  }
}
