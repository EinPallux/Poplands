/**
 * Wish bubbles (post-1.0): a soft "💭 icon" thought bubble that floats over a resident
 * who's left a wish, so you can see who wants what and place it nearby. World-anchored,
 * projected each frame from the live agent snapshot (same seam as SpeechLayer/WorldFx).
 * Fed by `request:new` (show) / `request:fulfilled` (pop away). Persistent — it stays
 * until granted, unlike the auto-dismissed speech bubble.
 */
import { bus } from '@/core/events';

type Project = (x: number, y: number, z: number) => { x: number; y: number; behind: boolean };
interface AgentPos {
  id: string;
  x: number;
  z: number;
}
interface WishBubble {
  el: HTMLDivElement;
  id: string;
}

export class WishLayer {
  private root: HTMLDivElement;
  private bubbles: WishBubble[] = [];

  constructor(
    parent: HTMLElement,
    private readonly project: Project,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'wish-layer';
    parent.appendChild(this.root);
    bus.on('request:new', (e) => this.show(e.id, e.icon));
    bus.on('request:fulfilled', (e) => this.grant(e.id));
  }

  private show(id: string, icon: string): void {
    this.remove(id); // one wish per resident — replace any stale bubble
    const el = document.createElement('div');
    el.className = 'wish-bubble';
    el.innerHTML = `<span class="wb-think">💭</span><span class="wb-icon">${icon}</span>`;
    this.root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in')); // spring-in
    this.bubbles.push({ el, id });
  }

  private grant(id: string): void {
    const b = this.bubbles.find((x) => x.id === id);
    if (!b) return;
    b.el.classList.add('granted'); // a happy pop-out
    const el = b.el;
    setTimeout(() => el.remove(), 320);
    this.bubbles = this.bubbles.filter((x) => x !== b);
  }

  private remove(id: string): void {
    const i = this.bubbles.findIndex((x) => x.id === id);
    if (i < 0) return;
    this.bubbles[i]!.el.remove();
    this.bubbles.splice(i, 1);
  }

  /** Project each wish bubble above its resident (called by the App loop). */
  update(agents: readonly AgentPos[], _dt: number): void {
    if (this.bubbles.length === 0) return;
    for (const b of this.bubbles) {
      const a = agents.find((x) => x.id === b.id);
      if (!a) {
        b.el.style.display = 'none';
        continue;
      }
      const proj = this.project(a.x, 2.05, a.z);
      if (proj.behind) {
        b.el.style.display = 'none';
        continue;
      }
      b.el.style.display = '';
      b.el.style.transform = `translate(${proj.x}px, ${proj.y}px) translate(-50%, -100%)`;
    }
  }
}
