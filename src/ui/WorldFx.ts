/**
 * World-anchored HUD (S21/S11): ripen bubbles floating over income buildings and
 * the coin-arc that flies collected Pops to the wallet counter. DOM projected
 * each frame from 3D positions (≤30 anchors, TECH §10). Reduced-motion collapses
 * the coin-arc to an instant tick (the counter already updates via signals).
 */
import { bus } from '@/core/events';
import { tweens, easings } from '@/core/tween';
import { isReducedMotion } from '@/core/settingsStore';

type Project = (x: number, y: number, z: number) => { x: number; y: number; behind: boolean };

interface Bubble {
  el: HTMLElement;
  x: number;
  y: number;
  z: number;
}

export class WorldFx {
  private root: HTMLDivElement;
  private bubbles = new Map<string, Bubble>();

  constructor(
    parent: HTMLElement,
    private readonly project: Project,
    private readonly popsAnchor: HTMLElement,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'worldfx';
    parent.appendChild(this.root);

    bus.on('income:progress', (e) => this.setBubble(e.placementId, e.wx, e.wz, e.fill));
    bus.on('income:ripe', (e) => this.ripe(e.placementId));
    bus.on('income:collected', (e) => {
      if (e.placementId) this.removeBubble(e.placementId);
      this.coinArc(e.wx, e.wz, Math.min(e.amount, 6));
    });
    bus.on('item:removed', (e) => this.removeBubble(e.id));
  }

  private setBubble(id: string, wx: number, wz: number, fill: number): void {
    let b = this.bubbles.get(id);
    if (!b) {
      const el = document.createElement('div');
      el.className = 'ripe-bubble';
      el.innerHTML = '<span>●</span>';
      this.root.appendChild(el);
      b = { el, x: wx, y: 1.7, z: wz };
      this.bubbles.set(id, b);
    }
    b.x = wx;
    b.z = wz;
    // grow through three steps; not-yet-ripe bubbles read small & pale
    const scale = 0.5 + fill * 0.5;
    b.el.style.setProperty('--fill', String(fill));
    b.el.style.setProperty('--scale', String(scale));
    b.el.classList.toggle('ripe', fill >= 1);
  }

  private ripe(id: string): void {
    const b = this.bubbles.get(id);
    if (b) b.el.classList.add('ripe');
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
      // control point for a gentle arc, jittered per coin
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

  /** Reposition bubbles from their world anchors — called each frame by App. */
  update(): void {
    for (const b of this.bubbles.values()) {
      const p = this.project(b.x, b.y, b.z);
      if (p.behind) {
        b.el.style.display = 'none';
        continue;
      }
      b.el.style.display = '';
      b.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(var(--scale, 1))`;
    }
  }
}
