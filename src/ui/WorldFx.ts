/**
 * World-anchored HUD (S21/S11): ripen bubbles over income buildings and the
 * coin-arc that flies collected Pops to the wallet counter.
 *
 * Ripen bubbles are DERIVED from economy state every frame (not event-synced) —
 * this is what makes the returning-player "island greets you" cascade work on
 * load and keeps a bubble correct across moves/collects with no event-ordering
 * bugs. The coin-arc stays event-driven (income:collected). DOM is projected
 * from 3D each frame (≤30 anchors, TECH §10). Reduced-motion collapses the
 * coin-arc to an instant tick (the counter already updates via signals).
 */
import { bus } from '@/core/events';
import { tweens, easings } from '@/core/tween';
import { itemDef } from '@/content/catalog';
import { isReducedMotion } from '@/core/settingsStore';
import type { EconomySystem } from '@/sim/EconomySystem';
import type { IslandModel } from '@/world/IslandModel';

type Project = (x: number, y: number, z: number) => { x: number; y: number; behind: boolean };

interface Bubble {
  el: HTMLElement;
  amtEl: HTMLElement;
  x: number;
  y: number;
  z: number;
  lastAmt: number; // cached rounded amount so we only touch the DOM text on change
  prominent: boolean;
}

const SHOW_THRESHOLD = 0.02; // hide the bubble on an empty (just-collected) building
// A building only surfaces the prominent "● amount" pill once it's meaningfully full,
// so the island doesn't get busy — ≥55% ripe AND ≥12 Pops banked (whichever is later).
const PROMINENT_FRAC = 0.55;
const PROMINENT_MIN = 12;

export class WorldFx {
  private root: HTMLDivElement;
  private bubbles = new Map<string, Bubble>();
  // reused across frames so update() allocates nothing in steady state (TECH §6.5)
  private live = new Set<string>();
  private stale: string[] = [];

  constructor(
    parent: HTMLElement,
    private readonly project: Project,
    private readonly popsAnchor: HTMLElement,
    private readonly economy: EconomySystem,
    private readonly island: IslandModel,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'worldfx';
    parent.appendChild(this.root);

    bus.on('income:collected', (e) => this.coinArc(e.wx, e.wz, Math.min(e.amount, 6)));
  }

  private ensureBubble(id: string, wx: number, wz: number, frac: number, amount: number): void {
    let b = this.bubbles.get(id);
    if (!b) {
      const el = document.createElement('div');
      el.className = 'ripe-bubble';
      // click the bubble itself to collect (not just the building) — user 2026-07-12
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (this.economy.ripeAmount(id) >= 1) bus.emit('cmd:collect', { placementId: id });
      });
      const dot = document.createElement('span');
      dot.className = 'rb-dot';
      dot.textContent = '●';
      const amtEl = document.createElement('span');
      amtEl.className = 'rb-amt';
      el.append(dot, amtEl);
      this.root.appendChild(el);
      b = { el, amtEl, x: wx, y: 1.7, z: wz, lastAmt: -1, prominent: false };
      this.bubbles.set(id, b);
    }
    b.x = wx;
    b.z = wz;
    b.el.style.setProperty('--fill', String(frac));
    const ripe = frac >= 1;
    b.el.classList.toggle('ripe', ripe);
    // surface the readable amount only once the building is worth a look
    const prominent = frac >= PROMINENT_FRAC && amount >= PROMINENT_MIN;
    if (prominent !== b.prominent) {
      b.prominent = prominent;
      b.el.classList.toggle('prominent', prominent);
    }
    if (prominent) {
      const rounded = Math.floor(amount);
      if (rounded !== b.lastAmt) {
        b.lastAmt = rounded;
        b.amtEl.textContent = `● ${rounded}`;
      }
      b.el.style.setProperty('--scale', '1');
    } else {
      b.el.style.setProperty('--scale', String(0.5 + Math.min(frac, 1) * 0.5));
    }
  }

  private removeBubble(id: string): void {
    const b = this.bubbles.get(id);
    if (!b) return;
    this.bubbles.delete(id);
    b.el.remove();
  }

  /** Fling a few coin sprites from a world point to the wallet counter. */
  private coinArc(wx: number, wz: number, count: number): void {
    if (isReducedMotion()) return;
    const from = this.project(wx, 1.4, wz);
    if (from.behind) return;
    const target = this.popsAnchor.getBoundingClientRect();
    const tx = target.left + target.width / 2;
    const ty = target.top + target.height / 2;
    for (let i = 0; i < count; i++) {
      const coin = document.createElement('div');
      coin.className = 'fly-coin';
      coin.textContent = '●';
      this.root.appendChild(coin);
      const cx = (from.x + tx) / 2 + (Math.random() - 0.5) * 120;
      const cy = Math.min(from.y, ty) - 60 - Math.random() * 60;
      tweens.start({
        duration: 0.55 + Math.random() * 0.12,
        delay: i * 0.04,
        ease: easings.cubicInOut,
        onUpdate: (t) => {
          const u = 1 - t;
          const x = u * u * from.x + 2 * u * t * cx + t * t * tx;
          const y = u * u * from.y + 2 * u * t * cy + t * t * ty;
          coin.style.transform = `translate(${x}px, ${y}px) scale(${1 - t * 0.35})`;
          coin.style.opacity = t > 0.85 ? String((1 - t) / 0.15) : '1';
        },
        onComplete: () => coin.remove(),
      });
    }
  }

  /**
   * Rebuild bubbles from live economy state + reposition. Called each frame by
   * App. Deriving from state (not events) fixes the load-greet and move cases.
   */
  update(): void {
    const live = this.live;
    live.clear();
    for (const p of this.island.allPlacements()) {
      const def = itemDef(p.def);
      if (!def?.income) continue;
      const frac = this.economy.ripeFraction(p.id);
      if (frac < SHOW_THRESHOLD) continue;
      live.add(p.id);
      // inline footprint-center (avoid footprintCenter's per-frame {x,z}+{w,d} allocs)
      const rotated = p.rot === 1 || p.rot === 3;
      const cx = p.wx + (rotated ? def.footprint.d : def.footprint.w) / 2;
      const cz = p.wz + (rotated ? def.footprint.w : def.footprint.d) / 2;
      const amount = this.economy.ripeAmount(p.id);
      this.ensureBubble(p.id, cx, cz, frac, amount);
    }
    // drop bubbles for buildings that are gone or emptied (collect stale ids into a
    // reused array — can't delete from the Map mid key-iteration without snapshotting)
    const stale = this.stale;
    stale.length = 0;
    for (const id of this.bubbles.keys()) if (!live.has(id)) stale.push(id);
    for (const id of stale) this.removeBubble(id);
    // project the survivors
    for (const b of this.bubbles.values()) {
      const proj = this.project(b.x, b.y, b.z);
      if (proj.behind) {
        b.el.style.display = 'none';
        continue;
      }
      b.el.style.display = '';
      b.el.style.transform = `translate(${proj.x}px, ${proj.y}px) translate(-50%, -50%) scale(var(--scale, 1))`;
    }
  }
}
