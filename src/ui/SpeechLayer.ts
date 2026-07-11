/**
 * Islander speech bubbles (S16/S21): a world-anchored cozy bubble over a tapped
 * neighbour's head. Pure DOM + events — fed by `npc:spoke`, positioned each frame
 * from the live agent snapshot (projected like WorldFx/SecretLayer), auto-dismissed
 * after a few seconds. Text flows through the string table (i18n-ready).
 */
import { bus } from '@/core/events';
import { t, type StringKey } from '@/core/strings';

type Project = (x: number, y: number, z: number) => { x: number; y: number; behind: boolean };
interface AgentPos {
  id: string;
  x: number;
  z: number;
}
interface Bubble {
  el: HTMLDivElement;
  id: string;
  ttl: number;
}

const BUBBLE_TTL = 3.2; // seconds a line lingers

export class SpeechLayer {
  private root: HTMLDivElement;
  private bubbles: Bubble[] = [];

  constructor(
    parent: HTMLElement,
    private readonly project: Project,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'speech-layer';
    parent.appendChild(this.root);
    bus.on('npc:spoke', (e) => this.say(e.id, e.textKey));
  }

  private say(id: string, textKey: StringKey): void {
    // one bubble per Islander — a fresh line replaces the old one
    const prev = this.bubbles.findIndex((b) => b.id === id);
    if (prev >= 0) {
      this.bubbles[prev]!.el.remove();
      this.bubbles.splice(prev, 1);
    }
    const el = document.createElement('div');
    el.className = 'speech-bubble';
    el.textContent = t(textKey);
    this.root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in')); // spring-in
    this.bubbles.push({ el, id, ttl: BUBBLE_TTL });
  }

  update(agents: readonly AgentPos[], dt: number): void {
    if (this.bubbles.length === 0) return;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]!;
      b.ttl -= dt;
      const a = agents.find((x) => x.id === b.id);
      if (!a || b.ttl <= 0) {
        const el = b.el;
        el.classList.remove('in');
        setTimeout(() => el.remove(), 220); // let the fade-out play
        this.bubbles.splice(i, 1);
        continue;
      }
      const proj = this.project(a.x, 1.55, a.z);
      if (proj.behind) {
        b.el.style.display = 'none';
        continue;
      }
      b.el.style.display = '';
      b.el.style.transform = `translate(${proj.x}px, ${proj.y}px) translate(-50%, -100%)`;
    }
  }
}
