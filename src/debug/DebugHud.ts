/**
 * Dev stats overlay (S24): fps, frame budget, draw calls, triangles, camera state.
 * Enabled with ?debug=1 or the backquote key. Dev-only concern, but tiny enough
 * to ship (it's the perf-budget watchdog of TECH §6.5).
 */
import type { WebGLRenderer } from 'three';
import type { GameLoop } from '@/app/GameLoop';
import type { CameraRig } from '@/render/CameraRig';
import { tweens } from '@/core/tween';
import { t } from '@/core/strings';

export class DebugHud {
  private root: HTMLDivElement;
  private accumulator = 0;
  visible: boolean;

  constructor(
    parent: HTMLElement,
    private readonly renderer: WebGLRenderer,
    private readonly loop: GameLoop,
    private readonly rig: CameraRig,
  ) {
    this.visible = new URLSearchParams(window.location.search).get('debug') === '1';
    this.root = document.createElement('div');
    this.root.className = 'debug-hud';
    this.root.style.display = this.visible ? 'block' : 'none';
    parent.appendChild(this.root);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.style.display = this.visible ? 'block' : 'none';
  }

  update(dt: number): void {
    if (!this.visible) return;
    this.accumulator += dt;
    if (this.accumulator < 0.25) return;
    this.accumulator = 0;
    const info = this.renderer.info;
    const cam = this.rig.state;
    const deg = (r: number) => ((r * 180) / Math.PI).toFixed(0);
    this.root.textContent = [
      `${t('debug.title')} — ${this.loop.fps.toFixed(0)} fps (${(1000 / Math.max(this.loop.fps, 1)).toFixed(1)} ms)`,
      `draws ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(0)}k`,
      `geo ${info.memory.geometries}  tex ${info.memory.textures}  tweens ${tweens.count}`,
      `cam az ${deg(cam.azimuth)}°  pol ${deg(cam.polar)}°  dist ${cam.distance.toFixed(1)}`,
    ].join('\n');
  }
}
