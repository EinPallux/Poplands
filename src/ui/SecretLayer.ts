/**
 * Secret markers (S19/S21): world-anchored sparkles over a chunk's hidden secret.
 * Pure DOM + events — clicking a marker emits `cmd:clickSecret`; a dig needs 3
 * clicks, a chest/flora one. Fed by `secret:spawned`; removed on `secret:found`;
 * projected each frame like WorldFx/SurveyLayer.
 */
import { bus, type SecretKind } from '@/core/events';

type Project = (x: number, y: number, z: number) => { x: number; y: number; behind: boolean };

interface Marker {
  el: HTMLButtonElement;
  wx: number;
  wz: number;
}

const GLYPH: Record<SecretKind, string> = { dig: '✨', chest: '🎁', flora: '🌸' };

export class SecretLayer {
  private root: HTMLDivElement;
  private markers = new Map<string, Marker>(); // key = "cx,cz"

  constructor(
    parent: HTMLElement,
    private readonly project: Project,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'secret-layer';
    parent.appendChild(this.root);
    bus.on('secret:spawned', (e) => this.add(e.cx, e.cz, e.kind, e.wx, e.wz));
    bus.on('secret:found', (e) => this.remove(e.cx, e.cz));
  }

  private add(cx: number, cz: number, kind: SecretKind, wx: number, wz: number): void {
    const key = `${cx},${cz}`;
    if (this.markers.has(key)) return;
    const el = document.createElement('button');
    el.className = 'secret-marker';
    el.textContent = GLYPH[kind];
    el.addEventListener('click', () => bus.emit('cmd:clickSecret', { cx, cz }));
    this.root.appendChild(el);
    this.markers.set(key, { el, wx: wx + 0.5, wz: wz + 0.5 });
  }

  private remove(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    const m = this.markers.get(key);
    if (m) {
      m.el.remove();
      this.markers.delete(key);
    }
  }

  update(): void {
    if (this.markers.size === 0) return;
    for (const m of this.markers.values()) {
      const proj = this.project(m.wx, 0.9, m.wz);
      if (proj.behind) {
        m.el.style.display = 'none';
        continue;
      }
      m.el.style.display = '';
      m.el.style.transform = `translate(${proj.x}px, ${proj.y}px) translate(-50%, -50%)`;
    }
  }
}
