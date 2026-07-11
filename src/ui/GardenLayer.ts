/**
 * Garden world-FX (post-1.0): a world-anchored marker over every planted plot that
 * shows the growth stage (🌱 sprout → 🌿 growing → the ripe crop, bobbing with a
 * glow) and a slim progress bar, plus a harvest popup (crop + reward) that rises and
 * fades when you reap. Projected from 3D each frame like WorldFx/FishingLayer;
 * reduced-motion drops the bob/animation. Purely presentational — it pulls the plot
 * snapshot from GardenSystem and reads its domain events, never touching sim state.
 */
import { bus, type AppEvents } from '@/core/events';
import { t } from '@/core/strings';
import { tweens, easings } from '@/core/tween';
import { isReducedMotion } from '@/core/settingsStore';
import type { PlotView } from '@/sim/GardenSystem';

type Project = (x: number, y: number, z: number) => { x: number; y: number; behind: boolean };
type Harvested = AppEvents['garden:harvested'];
type Reward = Harvested['rewards'];

const STAGE_ICON: Record<string, string> = { sprout: '🌱', growing: '🌿' };

export class GardenLayer {
  private root: HTMLDivElement;
  private markers = new Map<string, HTMLDivElement>();
  private time = 0;

  constructor(
    parent: HTMLElement,
    private readonly project: Project,
    private readonly plots: () => PlotView[],
  ) {
    this.root = document.createElement('div');
    this.root.className = 'garden-fx';
    parent.appendChild(this.root);

    bus.on('garden:harvested', (e) => this.spawnHarvest(e));
  }

  /** Reconcile + project the growth markers each frame (called by App's loop). */
  update(dt: number): void {
    this.time += dt;
    const reduced = isReducedMotion();
    const seen = new Set<string>();
    for (const plot of this.plots()) {
      seen.add(plot.placementId);
      const marker = this.markers.get(plot.placementId) ?? this.makeMarker(plot.placementId);
      const ripe = plot.stage === 'ripe';
      const bob = ripe && !reduced ? Math.sin(this.time * 3) * 0.08 : 0;
      const proj = this.project(plot.wx, 0.75 + bob, plot.wz);
      if (proj.behind) {
        marker.style.display = 'none';
        continue;
      }
      marker.style.display = '';
      marker.style.transform = `translate(${proj.x}px, ${proj.y}px) translate(-50%, -100%)`;
      const icon = ripe ? plot.icon : (STAGE_ICON[plot.stage] ?? '🌱');
      const cropEl = marker.querySelector('.gm-crop') as HTMLElement;
      if (cropEl.textContent !== icon) cropEl.textContent = icon;
      marker.classList.toggle('ripe', ripe);
      const fill = marker.querySelector('.gm-fill') as HTMLElement;
      fill.style.width = `${Math.round(plot.progress * 100)}%`;
    }
    for (const [id, el] of this.markers) {
      if (seen.has(id)) continue;
      el.remove();
      this.markers.delete(id);
    }
  }

  private makeMarker(id: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'garden-marker';
    el.innerHTML = '<span class="gm-crop">🌱</span><div class="gm-bar"><div class="gm-fill"></div></div>';
    this.root.appendChild(el);
    this.markers.set(id, el);
    return el;
  }

  private rewardText(r: Reward): string {
    const parts: string[] = [];
    if (r.pops) parts.push(`+${r.pops} ●`);
    if (r.stardust) parts.push(`+${r.stardust} ✦`);
    return parts.join('   ');
  }

  private spawnHarvest(e: Harvested): void {
    const proj = this.project(e.wx, 1.1, e.wz);
    const sx = proj.behind ? window.innerWidth / 2 : proj.x;
    const sy = proj.behind ? window.innerHeight * 0.4 : proj.y;
    const card = document.createElement('div');
    card.className = 'garden-harvest';
    card.innerHTML =
      `<span class="gh-icon">${e.icon}</span>` +
      `<span class="gh-name">${t(e.nameKey)}</span>` +
      `<span class="gh-reward">${this.rewardText(e.rewards)}</span>`;
    this.root.appendChild(card);

    if (isReducedMotion()) {
      card.style.transform = `translate(${sx}px, ${sy - 60}px) translate(-50%, -50%)`;
      window.setTimeout(() => card.remove(), 2000);
      return;
    }
    tweens.start({
      duration: 2.0,
      ease: easings.cubicOut,
      onUpdate: (tt) => {
        const rise = 30 + tt * 66;
        const pop = tt < 0.16 ? 0.6 + (tt / 0.16) * 0.4 : 1;
        card.style.transform = `translate(${sx}px, ${sy - rise}px) translate(-50%, -50%) scale(${pop})`;
        card.style.opacity = tt > 0.78 ? String((1 - tt) / 0.22) : '1';
      },
      onComplete: () => card.remove(),
    });
  }
}
